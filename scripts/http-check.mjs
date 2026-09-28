import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { startFixture, fixtureActor } from "./fixture-server.mjs";
const origin = "http://localhost:3300";
const fixture = await startFixture();
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--port", "3300"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
      SUPABASE_URL: "http://127.0.0.1:3301",
      SUPABASE_PUBLISHABLE_KEY: "fixture-publishable-key",
      ADMIN_OWNER_USER_IDS: fixtureActor.id,
      VD_ADMIN_API_URL: "http://127.0.0.1:3301",
      VD_ADMIN_API_TOKEN: "fixture-internal-token",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
child.stdout.on("data", (chunk) => (logs += chunk));
child.stderr.on("data", (chunk) => (logs += chunk));
let cookie = "";
let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks++;
}
async function call(path, method = "GET", body, extra = {}) {
  return fetch(`${origin}${path}`, {
    method,
    redirect: "manual",
    headers: {
      ...(method === "POST"
        ? { "Content-Type": "application/json", Origin: origin }
        : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      const response = await fetch(`${origin}/login`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(500);
  }
  assert.ok(ready, "Next dev server failed to start");
  check((await call("/dashboard")).status === 307, "anonymous page redirects");
  check(
    (await call("/api/admin/users")).status === 401,
    "anonymous API denied",
  );
  check(
    (await call("/api/auth/login", "POST", null)).status === 400,
    "malformed login rejected",
  );
  check(
    (
      await call("/api/auth/login", "POST", {
        email: "intruder@example.test",
        password: "fixture-password",
      })
    ).status === 401,
    "unbound identity denied",
  );
  const login = await call("/api/auth/login", "POST", {
    email: fixtureActor.email,
    password: "fixture-password",
  });
  check(login.ok, "owner logs in via actual auth route");
  const setCookie = login.headers.get("set-cookie");
  check(
    setCookie.includes("HttpOnly") && setCookie.includes("SameSite=strict"),
    "session cookie protected",
  );
  check(
    !(await login.text()).includes("fixture-owner-session"),
    "token absent from login JSON",
  );
  cookie = setCookie.split(";")[0];
  const page = await (await call("/dashboard")).text();
  check(
    page.includes("总览") &&
      page.includes("内测申请") &&
      page.includes("审计日志"),
    "Chinese shell rendered",
  );
  const users = await (await call("/api/admin/users")).text();
  check(
    users.includes(fixture.user.email),
    "authoritative user metadata returned",
  );
  check(
    !users.includes("PRIVATE_CONTENT_SENTINEL") &&
      !users.includes("SECRET_RESPONSE_SENTINEL"),
    "private content and arbitrary secrets stripped",
  );
  check(
    (await call("/api/admin/restricted-content")).status === 403,
    "bulk content GET forbidden",
  );
  const base = {
    target: fixture.user.id,
    reason: "本地合约验收已确认操作",
    input: {},
  };
  check(
    (
      await call(
        "/api/admin/bans",
        "POST",
        { ...base, action: "ban" },
        { Origin: "https://attacker.test" },
      )
    ).status === 403,
    "cross-site write denied",
  );
  check(
    (await call("/api/admin/audit", "POST", { ...base, action: "revoke" }))
      .status === 403,
    "immutable audit has no write capability",
  );
  check(
    (
      await call("/api/admin/bans", "POST", {
        ...base,
        action: "ban",
        reason: "短",
      })
    ).status === 400,
    "missing meaningful reason denied",
  );
  check(
    (
      await call("/api/admin/restricted-content", "POST", {
        ...base,
        action: "inspect",
      })
    ).status === 400,
    "unscoped restricted access denied",
  );
  for (const [resource, action, input] of [
    ["beta-applications", "approve", {}],
    [
      "invitations",
      "create",
      { kind: "personal", cohort: "fixture", limit: 1 },
    ],
    ["entitlements", "grant", { days: 7 }],
    ["entitlements", "revoke", {}],
    ["quotas", "adjust", { delta: 20 }],
    ["quotas", "reset", {}],
    ["bans", "ban", { reasonCode: "manual" }],
    ["bans", "unban", {}],
  ]) {
    const id = crypto.randomUUID();
    const command = { ...base, action, input };
    const first = await call(`/api/admin/${resource}`, "POST", command, {
      "Idempotency-Key": id,
    });
    check(first.ok, `${resource}/${action} accepted with audit`);
    const receipt = await first.json();
    check(
      receipt.auditEvent.requestId === id,
      `${resource}/${action} receipt matches`,
    );
    const count = fixture.audit.length;
    await call(`/api/admin/${resource}`, "POST", command, {
      "Idempotency-Key": id,
    });
    check(
      fixture.audit.length === count,
      "same idempotency key forwarded for retry",
    );
  }
  const restricted = await call("/api/admin/restricted-content", "POST", {
    ...base,
    action: "inspect",
    input: {
      category: "support",
      caseReference: "CASE-TEST",
      scope: "tasks",
      from: "2026-09-01T00:00:00Z",
      until: "2026-09-02T00:00:00Z",
    },
  });
  check(
    restricted.ok &&
      (await restricted.text()).includes("PRIVATE_CONTENT_SENTINEL"),
    "scoped content returned only after audit",
  );
  check(
    fixture.audit.at(-1).action === "inspect",
    "content access itself audited",
  );
  check(
    (
      await call("/api/admin/bans", "POST", {
        ...base,
        target: "missing-audit",
        action: "ban",
      })
    ).status === 502,
    "missing audit receipt never reported as success",
  );
  check(
    (await call("/api/auth/logout", "POST", {})).ok,
    "logout route succeeds",
  );
  cookie = "";
  check(
    (await call("/api/admin/users")).status === 401,
    "logged out requests denied",
  );
  console.log(
    `HTTP contract checks passed: ${checks}. Test fixtures only; no live provider or database calls.`,
  );
  if (process.env.KEEP_TEST_SERVERS === "1") {
    console.log(
      "Fixture and console available at http://localhost:3300 for browser verification.",
    );
    await new Promise(() => {});
  }
} catch (error) {
  console.error(logs.slice(-4000));
  throw error;
} finally {
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn(
        "taskkill",
        ["/pid", String(child.pid), "/T", "/F"],
        { stdio: "ignore" },
      );
      killer.once("exit", resolve);
    });
  } else child.kill("SIGTERM");
  fixture.server.closeAllConnections();
  fixture.server.close();
}
