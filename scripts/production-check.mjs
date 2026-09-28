import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const origin = "http://localhost:3302";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3302"],
  {
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      SUPABASE_URL: "",
      SUPABASE_PUBLISHABLE_KEY: "",
      ADMIN_OWNER_USER_IDS: "",
      VD_ADMIN_API_URL: "",
      VD_ADMIN_API_TOKEN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
child.stdout.on("data", (chunk) => (logs += chunk));
child.stderr.on("data", (chunk) => (logs += chunk));
try {
  let response;
  for (let i = 0; i < 40; i++) {
    try {
      response = await fetch(`${origin}/login`);
      if (response.ok) break;
    } catch {}
    await delay(250);
  }
  assert.ok(response?.ok, "production login page ready");
  const policy = response.headers.get("content-security-policy");
  assert.ok(policy?.includes("strict-dynamic"));
  assert.ok(!policy.includes("unsafe-eval"));
  const nonce = policy.match(/'nonce-([^']+)'/)[1];
  const html = await response.text();
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)];
  assert.ok(scripts.length > 0);
  for (const [, attributes] of scripts)
    assert.ok(
      attributes.includes(`nonce="${nonce}"`),
      "all production scripts carry request nonce",
    );
  assert.ok(html.includes("管理员认证尚未配置"));
  const second = await fetch(`${origin}/login`);
  assert.notEqual(
    second.headers.get("content-security-policy"),
    policy,
    "nonce is fresh per request",
  );
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.ok(response.headers.get("cache-control").includes("no-store"));
  assert.equal(
    (await fetch(`${origin}/dashboard`, { redirect: "manual" })).status,
    307,
  );
  assert.equal((await fetch(`${origin}/api/admin/users`)).status, 401);
  assert.equal(
    (
      await fetch(`${origin}/api/auth/login`, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    503,
  );
  console.log(
    "Production runtime checks passed: CSP nonce injection and rotation, protected pages/API, unconfigured login, no-store and frame protection.",
  );
} catch (error) {
  console.error(logs.slice(-3000));
  throw error;
} finally {
  if (process.platform === "win32")
    await new Promise((resolve) => {
      const killer = spawn(
        "taskkill",
        ["/pid", String(child.pid), "/T", "/F"],
        { stdio: "ignore" },
      );
      killer.once("exit", resolve);
    });
  else child.kill("SIGTERM");
}
