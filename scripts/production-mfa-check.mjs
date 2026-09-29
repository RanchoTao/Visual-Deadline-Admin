import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { startFixture, fixtureActor } from "./fixture-server.mjs";
const fixture = await startFixture(3304);
const origin = "http://localhost:3303";
const child = spawn(
  process.execPath,
  [
    "--import",
    pathToFileURL(resolve("scripts/auth-fixture-preload.mjs")).href,
    "node_modules/next/dist/bin/next",
    "start",
    "--port",
    "3303",
  ],
  {
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      SUPABASE_URL: "https://auth.example.test",
      SUPABASE_PUBLISHABLE_KEY: "fixture-public",
      ADMIN_OWNER_USER_IDS: fixtureActor.id,
      VD_ADMIN_API_URL: "",
      VD_ADMIN_API_TOKEN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "",
  cookie = "";
child.stdout.on("data", (c) => (logs += c));
child.stderr.on("data", (c) => (logs += c));
async function call(path, body) {
  return fetch(origin + path, {
    method: body ? "POST" : "GET",
    redirect: "manual",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await call("/login")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(250);
  }
  assert.ok(ready);
  assert.equal((await call("/api/auth/mfa", { action: "enroll" })).status, 401);
  async function login() {
    const response = await call("/api/auth/login", {
      email: fixtureActor.email,
      password: "fixture-password",
    });
    assert.equal(response.status, 200);
    const header = response.headers.get("set-cookie");
    assert.match(header, /HttpOnly/);
    assert.match(header, /Secure/);
    assert.match(header, /SameSite=strict/);
    cookie = header.split(";")[0];
    assert.equal((await response.json()).destination, "/mfa");
  }
  await login();
  const aal1 = cookie;
  const protectedPage = await call("/dashboard");
  assert.equal(protectedPage.status, 307);
  assert.equal(protectedPage.headers.get("location"), "/mfa");
  assert.equal((await call("/api/admin/users")).status, 403);
  assert.equal((await call("/api/admin/bans", { action: "ban" })).status, 403);
  assert.equal((await call("/mfa")).status, 200);
  const enroll = await call("/api/auth/mfa", { action: "enroll" });
  assert.equal(enroll.status, 200);
  const factor = await enroll.json();
  assert.equal(
    (
      await call("/api/auth/mfa", {
        action: "verify",
        factorId: factor.factorId,
        code: "000000",
      })
    ).status,
    400,
  );
  async function verify() {
    const response = await call("/api/auth/mfa", {
      action: "verify",
      factorId: factor.factorId,
      code: "123456",
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      destination: "/dashboard",
    });
    cookie = response.headers.get("set-cookie").split(";")[0];
    assert.equal((await call("/dashboard")).status, 200);
    // Auth accepted; the deliberately unconfigured VD gateway still fails closed.
    assert.equal((await call("/api/admin/users")).status, 503);
  }
  await verify();
  cookie = aal1;
  assert.equal((await call("/api/admin/users")).status, 403);
  assert.equal((await call("/api/auth/mfa", { action: "enroll" })).status, 409);
  await login();
  assert.match(await (await call("/mfa")).text(), /双重验证/);
  await verify();
  await call("/api/auth/logout", {});
  assert.equal((await call("/api/admin/users")).status, 401);
  assert.equal(
    (
      await call("/api/auth/mfa", {
        action: "verify",
        factorId: factor.factorId,
        code: "123456",
      })
    ).status,
    401,
  );
  assert.ok(
    !logs.includes("FIXTURE_TOTP_SECRET_SENTINEL") &&
      !logs.includes("FIXTURE_REFRESH_SECRET_SENTINEL"),
  );
  console.log(
    "Production MFA checks passed: owner enrollment, incorrect code, AAL1 page/API rejection, AAL2 page/API authorization, challenge login, stale AAL1 rejection, logout, cookie flags, secret-free logs.",
  );
} catch (error) {
  console.error(logs.slice(-2000));
  throw error;
} finally {
  if (process.platform === "win32")
    await new Promise((r) =>
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      }).once("exit", r),
    );
  else child.kill("SIGTERM");
  fixture.server.close();
}
