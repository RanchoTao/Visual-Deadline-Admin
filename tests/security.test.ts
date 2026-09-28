import test from "node:test";
import assert from "node:assert/strict";
import {
  ownerFromVerifiedUser,
  verifyAuthToken,
} from "../src/server/auth-policy";
import { can, canRead, canMutate } from "../src/lib/rbac";
import { sameOrigin } from "../src/lib/security";
import { createGateway, GatewayError } from "../src/server/gateway-core";
import { readOperation, writeOperation } from "../src/server/operations";
import {
  projectRead,
  projectRestrictedResult,
  projectMutationResult,
} from "../src/server/projection";
import { inspectProviders, pendingProvider } from "../src/server/provider-core";
import { navigation } from "../src/lib/catalog";
import { renderEmail, emailTemplates } from "../src/lib/email-templates";
import type { Actor, Resource, Action } from "../src/lib/contracts";
const owner: Actor = {
  id: "owner-id",
  email: "owner@example.test",
  role: "owner",
};
const verifiedUser = {
  id: owner.id,
  email: owner.email,
  email_confirmed_at: "2026-09-28T00:00:00Z",
};
const requestId = "d4b916df-fd0c-4dd5-9864-d740b6b2daa0";
const reason = "测试工单已确认此项变更";
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
test("only confirmed explicitly allowlisted identities become owners", () => {
  assert.deepEqual(ownerFromVerifiedUser(verifiedUser, "owner-id"), owner);
  assert.equal(
    ownerFromVerifiedUser(
      { ...verifiedUser, email_confirmed_at: null },
      "owner-id",
    ),
    null,
  );
  assert.equal(
    ownerFromVerifiedUser(
      { ...verifiedUser, id: "attacker", user_metadata: { role: "owner" } },
      "owner-id",
    ),
    null,
  );
  assert.equal(ownerFromVerifiedUser(verifiedUser, ""), null);
});
test("authentication validates opaque token with Supabase and fails closed", async () => {
  let authorization = "";
  const actor = await verifyAuthToken(
    "opaque-test-token",
    {
      url: "https://auth.example.test",
      key: "publishable-test",
      owners: owner.id,
    },
    async (_url, init) => {
      authorization = (init?.headers as Record<string, string>).Authorization;
      return response(verifiedUser);
    },
  );
  assert.deepEqual(actor, owner);
  assert.equal(authorization, "Bearer opaque-test-token");
  assert.equal(
    await verifyAuthToken(
      "invalid",
      { url: "https://auth.example.test", key: "public", owners: owner.id },
      async () => response({}, 401),
    ),
    null,
  );
  assert.equal(
    await verifyAuthToken(
      "invalid",
      { url: "https://auth.example.test", key: "public", owners: owner.id },
      async () => {
        throw new Error("offline");
      },
    ),
    null,
  );
});
test("RBAC grants narrow future roles and rejects escalation", () => {
  assert.equal(can("owner", "restricted_content.read"), true);
  assert.equal(canRead("reviewer", "users"), false);
  assert.equal(canMutate("reviewer", "beta-applications", "approve"), true);
  assert.equal(canMutate("support", "entitlements", "grant"), false);
  assert.equal(canMutate("analyst", "bans", "ban"), false);
  assert.equal(canMutate("admin", "restricted-content", "inspect"), false);
  assert.equal(canMutate("owner", "audit", "revoke"), false);
});
test("privileged reads and writes reject unauthenticated requests before adapter invocation", async () => {
  const gateway = createGateway();
  await assert.rejects(
    readOperation(gateway, null, "users", new URLSearchParams()),
    (error: unknown) => error instanceof GatewayError && error.status === 401,
  );
  await assert.rejects(
    writeOperation(gateway, null, "bans", {}, requestId),
    (error: unknown) => error instanceof GatewayError && error.status === 401,
  );
  await assert.rejects(
    readOperation(
      gateway,
      { ...owner, role: "support" },
      "audit",
      new URLSearchParams(),
    ),
    (error: unknown) => error instanceof GatewayError && error.status === 403,
  );
});
test("same-origin mutation protection rejects missing and cross-site origins", () => {
  assert.equal(
    sameOrigin(
      new Request("https://admin.visualdeadline.com/api", {
        headers: { origin: "https://admin.visualdeadline.com" },
      }),
    ),
    true,
  );
  assert.equal(
    sameOrigin(
      new Request("https://admin.visualdeadline.com/api", {
        headers: { origin: "https://attacker.test" },
      }),
    ),
    false,
  );
  assert.equal(
    sameOrigin(new Request("https://admin.visualdeadline.com/api")),
    false,
  );
});
test("unconfigured VD gateway cannot mutate", async () => {
  await assert.rejects(
    writeOperation(
      createGateway(),
      owner,
      "entitlements",
      { action: "grant", target: "user-id", reason, input: { days: 7 } },
      requestId,
    ),
    (error: unknown) =>
      error instanceof GatewayError && error.code === "CONTRACT_PENDING",
  );
});
const flows: {
  resource: Resource;
  action: Action;
  input: Record<string, unknown>;
}[] = [
  { resource: "beta-applications", action: "approve", input: {} },
  {
    resource: "entitlements",
    action: "grant",
    input: { days: 7, source: "admin_grant" },
  },
  { resource: "entitlements", action: "revoke", input: {} },
  { resource: "quotas", action: "adjust", input: { delta: 20 } },
  { resource: "quotas", action: "reset", input: {} },
  { resource: "bans", action: "ban", input: { reasonCode: "manual" } },
  { resource: "bans", action: "unban", input: {} },
  {
    resource: "restricted-content",
    action: "inspect",
    input: {
      category: "support",
      caseReference: "CASE-001",
      scope: "tasks",
      from: "2026-09-01T00:00:00Z",
      until: "2026-09-02T00:00:00Z",
    },
  },
];
for (const flow of flows)
  test(`${flow.resource}/${flow.action} forwards authoritative command and requires matching audit receipt`, async () => {
    let called = false;
    const gateway = createGateway(
      "https://vd.example.test",
      "server-test-token",
      async (url, init) => {
        called = true;
        assert.equal(
          String(url),
          `https://vd.example.test/v1/admin/${flow.resource}/actions`,
        );
        const headers = init!.headers as Record<string, string>;
        assert.equal(headers["Idempotency-Key"], requestId);
        assert.equal(headers["X-Admin-Actor"], owner.id);
        const command = JSON.parse(String(init!.body));
        assert.deepEqual(command.input, flow.input);
        assert.equal(command.reason, reason);
        return response({
          result: {},
          auditEvent: {
            id: "audit-id",
            actor: owner.id,
            action: flow.action,
            target: "user-id",
            reason,
            before: null,
            after: { status: "active" },
            timestamp: "2026-09-28T00:00:00Z",
            requestId,
          },
        });
      },
    );
    const result = await writeOperation(
      gateway,
      owner,
      flow.resource,
      { action: flow.action, target: "user-id", reason, input: flow.input },
      requestId,
    );
    assert.equal(called, true);
    assert.equal(result.auditEvent.requestId, requestId);
  });
test("no success without an audit receipt and upstream errors do not leak bodies", async () => {
  const gateway = createGateway("https://vd.example.test", "token", async () =>
    response({ result: { changed: true } }),
  );
  await assert.rejects(
    writeOperation(
      gateway,
      owner,
      "bans",
      { action: "ban", target: "user-id", reason, input: {} },
      requestId,
    ),
    (error: unknown) =>
      error instanceof GatewayError && error.code === "AUDIT_RECEIPT_MISSING",
  );
  const bad = createGateway(
    "https://vd.example.test",
    "token",
    async () => new Response("sensitive upstream error", { status: 500 }),
  );
  await assert.rejects(
    bad.read("users", owner, new URLSearchParams()),
    (error: unknown) =>
      error instanceof GatewayError && !error.message.includes("sensitive"),
  );
});
test("restricted content cannot be browsed via GET or without a case and time window", async () => {
  await assert.rejects(
    readOperation(
      createGateway(),
      owner,
      "restricted-content",
      new URLSearchParams(),
    ),
    (error: unknown) => error instanceof GatewayError && error.status === 403,
  );
  await assert.rejects(
    writeOperation(
      createGateway(),
      owner,
      "restricted-content",
      {
        action: "inspect",
        target: "user-id",
        reason,
        input: { scope: "tasks" },
      },
      requestId,
    ),
    (error: unknown) =>
      error instanceof GatewayError && error.code === "CASE_REQUIRED",
  );
});
test("normal responses strip arbitrary private content and provider objects", () => {
  const result = projectRead("users", {
    items: [
      {
        id: "user-id",
        email: "user@example.test",
        rawTasks: [{ title: "private" }],
        accessToken: "secret",
        password: "secret",
        name: "用户",
        entitlementSources: [
          { source: "admin_grant", status: "active", secret: "secret" },
        ],
      },
    ],
    summary: { totalUsers: 1, token: "secret" },
  });
  assert.equal(JSON.stringify(result).includes("secret"), false);
  assert.equal(JSON.stringify(result).includes("private"), false);
  assert.equal(result.items[0].email, "user@example.test");
});
test("provider failures are isolated", async () => {
  const result = await inspectProviders([
    {
      name: "Vercel",
      async inspect() {
        throw new Error("provider unavailable");
      },
    },
    pendingProvider("GitHub", "pending"),
  ]);
  assert.equal(result[0].status, "unavailable");
  assert.equal(result[1].status, "pending");
});
test("restricted and mutation receipts expose only minimum permitted DTO fields", () => {
  const result = projectRestrictedResult(
    {
      scope: "tasks",
      items: [
        {
          id: "scoped-id",
          content: "allowed user content",
          internalToken: "SECRET_SENTINEL",
        },
      ],
      serviceRole: "SECRET_SENTINEL",
    },
    "tasks",
  );
  assert.equal(JSON.stringify(result).includes("SECRET_SENTINEL"), false);
  assert.throws(() =>
    projectRestrictedResult({ scope: "reviews", items: [] }, "tasks"),
  );
  assert.deepEqual(
    projectMutationResult({ inviteCode: "SAFE-CODE", internalToken: "secret" }),
    { inviteCode: "SAFE-CODE" },
  );
});
test("all required navigation labels are Chinese", () => {
  assert.deepEqual(
    navigation.map((item) => item.label),
    [
      "总览",
      "用户",
      "内测申请",
      "邀请码",
      "会员与额度",
      "AI 用量",
      "邮件",
      "反馈与举报",
      "风控与封禁",
      "商业分析",
      "基础设施",
      "版本与部署",
      "审计日志",
      "设置",
    ],
  );
});
test("all eight Chinese email templates render safely and invitation URL cannot be replaced", () => {
  assert.equal(Object.keys(emailTemplates).length, 8);
  for (const key of Object.keys(emailTemplates))
    assert.ok(
      renderEmail(key as keyof typeof emailTemplates, {
        name: "用户",
      }).html.includes("support@visualdeadline.com"),
    );
  const invitation = renderEmail("invitation", {
    name: "<script>bad</script>",
    code: "VD-TEST",
    expiresAt: "2026-10-01",
    registrationUrl: "https://visualdeadline.com",
  });
  assert.equal(invitation.html.includes("<script>"), false);
  assert.ok(invitation.html.includes("VD-TEST"));
  assert.throws(() =>
    renderEmail("invitation", { registrationUrl: "https://attacker.test" }),
  );
});
