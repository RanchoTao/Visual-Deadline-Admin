// Local contract-test double only. Never imported by the application.
import { createServer } from "node:http";
export const fixtureActor = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.test",
  email_confirmed_at: "2026-09-28T00:00:00Z",
};
export function startFixture(port = 3301) {
  const factors = [];
  const sessions = new Map();
  function issue(aal = "aal1") {
    const token = `fixture.${Buffer.from(JSON.stringify({ sub: fixtureActor.id, exp: Math.floor(Date.now() / 1000) + 3600, aal, jti: crypto.randomUUID() })).toString("base64url")}.signature`;
    sessions.set(token, aal);
    return token;
  }
  const audit = [];
  const commands = [];
  const user = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "operator-test@example.test",
    name: "合约测试账号",
    createdAt: "2026-09-01T08:00:00Z",
    lastActiveAt: null,
    cohort: "合约测试",
    inviteCode: "CONTRACT-TEST",
    inviteSource: "测试 fixture",
    membershipStatus: "free",
    effectivePlus: false,
    validUntil: null,
    entitlementSources: [],
    adminGrants: [],
    policy: "尚未接入",
    limit: null,
    used: null,
    remaining: null,
    accountStatus: "normal",
    tasksCount: null,
    goalsCount: null,
    reviewsCount: null,
    rawTasks: [{ title: "PRIVATE_CONTENT_SENTINEL" }],
    accessToken: "SECRET_RESPONSE_SENTINEL",
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    let raw = "";
    for await (const chunk of request) raw += chunk;
    function json(value, status = 200) {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(value));
    }
    if (url.pathname === "/auth/v1/token") {
      const input = JSON.parse(raw || "{}");
      if (input.password !== "fixture-password") return json({}, 401);
      return json({
        access_token:
          input.email === fixtureActor.email
            ? issue()
            : "fixture-intruder-session",
        expires_in: 3600,
      });
    }
    const bearer = request.headers.authorization?.replace(/^Bearer /, "");
    if (url.pathname === "/auth/v1/user")
      return sessions.has(bearer)
        ? json({ ...fixtureActor, factors })
        : json({}, 401);
    if (url.pathname === "/auth/v1/logout") {
      sessions.delete(bearer);
      return json({});
    }
    if (url.pathname.startsWith("/auth/v1/factors")) {
      if (!sessions.has(bearer)) return json({}, 401);
      if (url.pathname === "/auth/v1/factors") {
        const factor = {
          id: crypto.randomUUID(),
          factor_type: "totp",
          status: "unverified",
        };
        factors.push(factor);
        return json({
          id: factor.id,
          totp: {
            secret: "FIXTURE_TOTP_SECRET_SENTINEL",
            qr_code:
              '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="10" y="100">Local fixture only</text></svg>',
          },
        });
      }
      const factor = factors.find((f) => f.id === url.pathname.split("/")[4]);
      if (!factor) return json({}, 404);
      if (url.pathname.endsWith("/challenge")) {
        factor.challenge = crypto.randomUUID();
        return json({ id: factor.challenge });
      }
      const input = JSON.parse(raw);
      if (input.code !== "123456" || input.challenge_id !== factor.challenge)
        return json({}, 400);
      delete factor.challenge;
      factor.status = "verified";
      return json({
        access_token: issue("aal2"),
        refresh_token: "FIXTURE_REFRESH_SECRET_SENTINEL",
        expires_in: 3600,
      });
    }
    if (
      request.headers.authorization !== "Bearer fixture-internal-token" ||
      request.headers["x-admin-actor"] !== fixtureActor.id
    )
      return json({}, 403);
    const resource = url.pathname.split("/")[3];
    if (request.method === "POST") {
      const command = JSON.parse(raw);
      commands.push({ resource, ...command });
      if (command.target === "missing-audit")
        return json({ result: { changed: true } });
      const existing = audit.find(
        (event) => event.requestId === command.requestId,
      );
      const event = existing ?? {
        id: `audit-${audit.length + 1}`,
        actor: fixtureActor.id,
        action: command.action,
        target: command.target,
        reason: command.reason,
        before: { status: "normal" },
        after: { status: "active" },
        timestamp: new Date().toISOString(),
        requestId: command.requestId,
      };
      if (!existing) audit.push(event);
      return json({
        result:
          resource === "restricted-content"
            ? {
                scope: command.input.scope,
                items: [
                  {
                    id: "scoped-test-content",
                    content: "PRIVATE_CONTENT_SENTINEL",
                    secret: "SECRET_RESPONSE_SENTINEL",
                  },
                ],
              }
            : {},
        auditEvent: event,
      });
    }
    if (resource === "users")
      return json({
        items: url.searchParams.get("q") === "not-found" ? [] : [user],
      });
    if (resource === "audit") return json({ items: audit });
    if (resource === "beta-applications")
      return json({
        items: [
          {
            id: "application-test",
            name: "合约测试申请",
            email: "applicant@example.test",
            organization: "测试机构",
            role: "测试身份",
            useCase: "本地契约验收",
            source: "fixture",
            createdAt: "2026-09-28T00:00:00Z",
            status: "pending",
            reviewNote: null,
            history: [],
            submittedFields: [{ label: "补充信息", value: "仅用于合约测试" }],
          },
        ],
      });
    if (resource === "invitations")
      return json({
        items: [
          {
            id: "invite-test",
            code: "CONTRACT-TEST",
            cohort: "合约测试",
            kind: "personal",
            status: "active",
            used: 0,
            limit: 1,
            expiresAt: "2026-10-01T00:00:00Z",
            createdAt: "2026-09-28T00:00:00Z",
            source: "fixture",
            note: "仅用于合约测试",
          },
        ],
      });
    return json({
      items: [],
      summary: {
        databaseEnvironment: "本地合约测试 fixture",
        totalUsers: null,
      },
    });
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () =>
      resolve({ server, audit, commands, user }),
    ),
  );
}
