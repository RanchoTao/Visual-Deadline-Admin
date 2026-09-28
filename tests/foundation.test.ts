import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  verifyOwnerSession,
  adminSessionAllowed,
  sessionDestination,
} from "../src/server/auth-policy";
import { effectiveTier, tierCapabilities, tierOrder } from "../src/lib/tiers";
import { projectRead } from "../src/server/projection";
import { writeOperation } from "../src/server/operations";
import { createGateway } from "../src/server/gateway-core";
const owner = {
  id: "owner",
  email: "owner@example.test",
  role: "owner" as const,
};
const config = {
  url: "https://auth.example.test",
  key: "fixture",
  owners: owner.id,
};
const user = {
  ...owner,
  email_confirmed_at: "2026-09-28",
  factors: [{ id: "factor", factor_type: "totp", status: "verified" }],
};
const jwt = (claims: Record<string, unknown>) =>
  `header.${Buffer.from(JSON.stringify({ sub: owner.id, exp: Date.now() / 1000 + 600, ...claims })).toString("base64url")}.signature`;
const auth =
  (value: unknown = user, status = 200) =>
  async () =>
    new Response(JSON.stringify(value), { status });
for (const aal of ["aal1", "aal2"] as const)
  test(`production ${aal} enforcement and documented development policy`, async () => {
    const session = await verifyOwnerSession(jwt({ aal }), config, auth());
    assert.ok(session);
    assert.equal(adminSessionAllowed(session, "production"), aal === "aal2");
    assert.equal(adminSessionAllowed(session, "development"), true);
    assert.equal(adminSessionAllowed(session, "test"), aal === "aal2");
    assert.equal(
      sessionDestination(session, "production"),
      aal === "aal2" ? "/dashboard" : "/mfa",
    );
  });
test("AAL claims never bypass remote verification, owner allowlist or email confirmation", async () => {
  for (const fetcher of [
    auth({}, 401),
    auth({
      ...user,
      id: "attacker",
      user_metadata: { role: "owner", aal: "aal2" },
    }),
    auth({ ...user, email_confirmed_at: null }),
  ]) {
    assert.equal(
      await verifyOwnerSession(jwt({ aal: "aal2" }), config, fetcher),
      null,
    );
  }
  const session = await verifyOwnerSession(
    jwt({ aal: "aal1", user_metadata: { aal: "aal2", role: "owner" } }),
    config,
    auth(),
  );
  assert.equal(adminSessionAllowed(session, "production"), false);
});
test("expired, malformed and subject-mismatched tokens fail closed even after upstream success", async () => {
  for (const token of [
    "malformed",
    jwt({ exp: 1, aal: "aal2" }),
    jwt({ sub: "attacker", aal: "aal2" }),
  ])
    assert.equal(await verifyOwnerSession(token, config, auth()), null);
  assert.equal(adminSessionAllowed(null, "development"), false);
});
test("development owner without factors may use password; production must enroll", async () => {
  const session = (await verifyOwnerSession(
    jwt({ aal: "aal1" }),
    config,
    auth({ ...user, factors: [] }),
  ))!;
  assert.equal(sessionDestination(session, "development"), "/dashboard");
  assert.equal(sessionDestination(session, "production"), "/mfa");
});
test("legacy Plus remains readable and explicit authoritative tier wins", () => {
  assert.equal(effectiveTier({ effectivePlus: true }), "plus");
  assert.equal(effectiveTier({ capabilities: ["vd.plus"] }), "plus");
  assert.equal(effectiveTier({ effectivePlus: false }), "free");
  assert.equal(
    effectiveTier({ effectiveTier: "pro", effectivePlus: false }),
    "pro",
  );
  assert.equal(
    effectiveTier({ effectiveTier: "free", effectivePlus: true }),
    "free",
  );
  const row = projectRead("users", {
    items: [{ id: "u", effectivePlus: true }],
  }).items[0];
  assert.equal(row.effectiveTier, "plus");
  assert.deepEqual(row.capabilities, ["vd.plus"]);
});
test("tier ordering and capability inheritance", () => {
  assert.ok(tierOrder.pro > tierOrder.plus && tierOrder.plus > tierOrder.free);
  assert.deepEqual(tierCapabilities("free"), []);
  assert.deepEqual(tierCapabilities("pro"), ["vd.plus", "vd.pro"]);
});
test("dated tier sources survive projection without private fields", () => {
  const row = projectRead("users", {
    items: [
      {
        id: "u",
        effectiveTier: "pro",
        currentTier: "pro",
        entitlementSources: [
          {
            tier: "pro",
            source: "beta_gift",
            validFrom: "2026-10-27",
            validUntil: "2026-11-27",
            secret: "hidden",
          },
        ],
      },
    ],
  }).items[0];
  assert.deepEqual(row.entitlementSources, [
    {
      tier: "pro",
      source: "beta_gift",
      validFrom: "2026-10-27",
      validUntil: "2026-11-27",
    },
  ]);
});
for (const support of [
  undefined,
  { grantableTiers: ["pro"] },
  { contract: "vd-admin-tiers-v1", grantableTiers: ["plus"] },
])
  test("Pro fails closed without authoritative support", async () => {
    let mutations = 0;
    const service = {
      read: async () => ({
        items: [],
        summary: { adminGrantSupport: support },
      }),
      mutate: async () => {
        mutations++;
        throw new Error();
      },
    };
    await assert.rejects(
      writeOperation(
        service,
        owner,
        "entitlements",
        {
          action: "grant",
          target: "u",
          reason: "verified test request",
          input: { tier: "pro" },
        },
        "request",
      ),
      { code: "PRO_NOT_SUPPORTED" },
    );
    assert.equal(mutations, 0);
  });
test("Pro support is read from backend and admin grants never address Paddle records", async () => {
  const calls: string[] = [];
  const body = {
    action: "grant",
    target: "u",
    reason: "verified test request",
    input: { tier: "pro", source: "admin_grant" },
  };
  const gateway = createGateway(
    "https://vd.example.test",
    "fixture",
    async (url, init) => {
      calls.push(String(url));
      if (init?.method !== "POST")
        return new Response(
          JSON.stringify({
            items: [],
            summary: {
              adminGrantSupport: {
                contract: "vd-admin-tiers-v1",
                grantableTiers: ["plus", "pro"],
              },
            },
          }),
        );
      const command = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({
          result: {},
          auditEvent: {
            id: "a",
            actor: owner.id,
            action: command.action,
            target: command.target,
            reason: command.reason,
            requestId: command.requestId,
            before: {},
            after: {},
            timestamp: new Date().toISOString(),
          },
        }),
      );
    },
  );
  await writeOperation(gateway, owner, "entitlements", body, "request");
  assert.deepEqual(calls, [
    "https://vd.example.test/v1/admin/settings?",
    "https://vd.example.test/v1/admin/entitlements/actions",
  ]);
  for (const input of [
    { tier: "pro", subscriptionId: "sub" },
    { source: "subscription" },
    { capabilities: ["vd.pro"] },
    { tier: "free" },
    { tier: ["pro"] },
  ])
    await assert.rejects(
      writeOperation(
        gateway,
        owner,
        "entitlements",
        { ...body, input },
        "request",
      ),
    );
  assert.equal(calls.length, 2);
});
test("MFA client does not persist or log secrets, and server errors are generic", () => {
  const client = readFileSync("src/components/Mfa.tsx", "utf8");
  assert.doesNotMatch(
    client,
    /console\.|localStorage|sessionStorage|document\.cookie|dangerouslySetInnerHTML/,
  );
  assert.match(client, /setEnrollment\(null\)/);
  const route = readFileSync("src/app/api/auth/mfa/route.ts", "utf8");
  assert.doesNotMatch(route, /console\.|refresh_token/);
  assert.match(route, /no-store/);
});
