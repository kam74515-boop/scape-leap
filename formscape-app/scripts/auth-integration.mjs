/* eslint-disable no-await-in-loop -- Readiness probes are intentionally sequential. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { Pool } from "pg";

const databaseUrl = process.env.AUTH_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("AUTH_TEST_DATABASE_URL is required");

const pool = new Pool({ connectionString: databaseUrl });
const { rows } = await pool.query("SELECT current_database() AS name");
if (!String(rows[0]?.name || "").endsWith("_test")) {
  throw new Error("Refusing to reset a database whose name does not end in _test");
}
await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
await pool.end();

const port = 18081;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["scripts/mock-api.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DATABASE_POOL_SIZE: "3",
    SCAPELEAP_PUBLIC_URL: "http://127.0.0.1:3000",
    SCAPELEAP_BOOTSTRAP_ADMIN_EMAIL: "admin@museart.cloud",
    SCAPELEAP_BOOTSTRAP_ADMIN_PASSWORD: "Fs!IntegrationTest9aA",
    SCAPELEAP_BOOTSTRAP_ADMIN_NAME: "构境测试管理员",
    SCAPELEAP_AUDIT_SALT: "integration-test-audit-salt",
    SCAPELEAP_SIGNUP_ENABLED: "true",
    FS_SQLITE_MIGRATION_PATH: "/tmp/scapeleap-auth-integration-nonexistent.db",
    PLANE_MOCK_API_HOST: "127.0.0.1",
    PLANE_MOCK_API_PORT: String(port),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.on("data", (chunk) => (serverOutput += chunk.toString()));
server.stderr.on("data", (chunk) => (serverOutput += chunk.toString()));

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api`);
      if (response.ok) return;
    } catch {
      // Server is still initializing its schema.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`API did not become ready:\n${serverOutput}`);
}

function createBrowser() {
  const cookies = new Map();
  return async (path, options = {}) => {
    const headers = new Headers(options.headers);
    if (cookies.size > 0) {
      headers.set("Cookie", [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; "));
    }
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers, redirect: options.redirect || "manual" });
    for (const setCookie of response.headers.getSetCookie()) {
      const [pair] = setCookie.split(";");
      const index = pair.indexOf("=");
      const key = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (setCookie.includes("Max-Age=0")) cookies.delete(key);
      else cookies.set(key, value);
    }
    return response;
  };
}

async function csrf(browser) {
  const response = await browser("/auth/get-csrf-token/");
  assert.equal(response.status, 200);
  return (await response.json()).csrf_token;
}

async function jsonRequest(browser, path, token, body) {
  return browser(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFTOKEN": token },
    body: JSON.stringify(body),
  });
}

try {
  await waitForServer();
  const anonymous = createBrowser();
  assert.equal((await anonymous("/api/users/me/")).status, 401);

  const admin = createBrowser();
  const adminCsrf = await csrf(admin);
  assert.equal(
    (
      await jsonRequest(admin, "/auth/sign-in/", adminCsrf, {
        email: "admin@museart.cloud",
        password: "wrong",
      })
    ).status,
    401
  );
  assert.equal(
    (
      await jsonRequest(admin, "/auth/sign-in/", adminCsrf, {
        email: "admin@museart.cloud",
        password: "Fs!IntegrationTest9aA",
      })
    ).status,
    200
  );

  const currentAdmin = await (await admin("/api/users/me/")).json();
  assert.equal(currentAdmin.role, "owner");
  assert.equal(currentAdmin.is_password_autoset, true);

  const health = await (await admin("/api/fs/_health")).json();
  assert.equal(health.driver, "postgresql");
  assert.equal(health.counts.projects, 3);

  const overview = await (await admin("/api/admin/overview/")).json();
  assert.equal(overview.users.total, 1);
  assert.ok(overview.database.extensions.some((extension) => extension.extname === "vector"));

  const adminSessionCsrf = await csrf(admin);
  const createResponse = await jsonRequest(admin, "/api/admin/users/", adminSessionCsrf, {
    email: "member@museart.cloud",
    display_name: "测试成员",
    role: "member",
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.ok(created.temporary_password);

  const member = createBrowser();
  const memberCsrf = await csrf(member);
  assert.equal(
    (
      await jsonRequest(member, "/auth/sign-in/", memberCsrf, {
        email: "member@museart.cloud",
        password: created.temporary_password,
      })
    ).status,
    200
  );
  assert.equal((await member("/api/admin/overview/")).status, 403);
  assert.equal((await (await member("/api/users/me/")).json()).is_password_autoset, true);

  const memberSessionCsrf = await csrf(member);
  assert.equal(
    (
      await jsonRequest(member, "/auth/set-password/", memberSessionCsrf, {
        password: "Aa1!aaa",
      })
    ).status,
    400
  );
  assert.equal(
    (
      await jsonRequest(member, "/auth/set-password/", memberSessionCsrf, {
        password: "Aa1!aaaa",
      })
    ).status,
    200
  );
  assert.equal((await (await member("/api/users/me/")).json()).is_password_autoset, false);

  const signOutCsrf = await csrf(member);
  assert.equal((await jsonRequest(member, "/auth/sign-out/", signOutCsrf, {})).status, 303);
  assert.equal((await member("/api/users/me/")).status, 401);

  process.stdout.write("PostgreSQL authentication integration passed\n");
} finally {
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), new Promise((resolve) => setTimeout(resolve, 3_000))]);
}
