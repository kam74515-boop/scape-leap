/**
 * PostgreSQL 认证与会话边界。
 *
 * 密码使用 scrypt；浏览器持有随机会话令牌，数据库只保存 SHA-256 摘要。
 * 所有状态修改都要求 SameSite 会话 + 双提交 CSRF。
 */
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import nodemailer from "nodemailer";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "scapeleap_session";
const CSRF_COOKIE = "scapeleap_csrf";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_MIN_LENGTH = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const PUBLIC_URL = (process.env.SCAPELEAP_PUBLIC_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

const LOCAL_USER = {
  id: "user-local-1",
  email: "designer@formscape.local",
  display_name: "林设计师",
  first_name: "林",
  last_name: "设计师",
  role: "owner",
  is_active: true,
  is_email_verified: true,
  must_change_password: false,
  created_at: "2024-01-01T00:00:00.000Z",
  last_login_at: "2024-01-01T00:00:00.000Z",
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function validatePassword(value) {
  const password = String(value || "");
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(String(password), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${Buffer.from(hash).toString("base64url")}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, n, r, p, saltValue, hashValue] = String(encoded || "").split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;
  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(hashValue, "base64url");
  const actual = await scrypt(String(password), salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index < 0
          ? [decodeURIComponent(part), ""]
          : [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("request_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        if (String(req.headers["content-type"] || "").includes("application/json")) {
          resolve(JSON.parse(raw));
        } else {
          resolve(Object.fromEntries(new URLSearchParams(raw)));
        }
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function cookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "SameSite=Lax"];
  if (PUBLIC_URL.startsWith("https://")) parts.push("Secure");
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

function sendJson(req, res, status, body, headers = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(data);
}

function redirect(res, location, headers = {}) {
  res.writeHead(303, { Location: location, "Cache-Control": "no-store", ...headers });
  res.end();
}

function wantsJson(req) {
  return (
    String(req.headers["content-type"] || "").includes("application/json") ||
    String(req.headers.accept || "").includes("application/json")
  );
}

function authError(req, res, code, email, status = 400, path = "/") {
  if (wantsJson(req)) return sendJson(req, res, status, { error_code: code, error: "authentication_failed" });
  const params = new URLSearchParams({ error_code: code });
  if (email) params.set("email", email);
  return redirect(res, `${path}?${params.toString()}`);
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim();
}

function userAgent(req) {
  return String(req.headers["user-agent"] || "").slice(0, 500);
}

export function publicUser(user) {
  const firstName = user.first_name || "";
  const lastName = user.last_name || "";
  return {
    id: user.id,
    avatar_url: user.avatar_url || "",
    cover_image_url: null,
    cover_image: null,
    date_joined: new Date(user.created_at).toISOString(),
    display_name: user.display_name || `${firstName}${lastName}` || user.email.split("@")[0],
    email: user.email,
    first_name: firstName,
    last_name: lastName,
    is_active: user.is_active,
    is_bot: false,
    is_email_verified: user.is_email_verified,
    is_password_autoset: user.must_change_password,
    is_tour_completed: true,
    mobile_number: null,
    last_workspace_id: "ws-demo",
    user_timezone: user.timezone || "Asia/Shanghai",
    username: user.email.split("@")[0],
    last_login_medium: "email",
    theme: { theme: "light", primary: "", background: "", darkPalette: false },
    role: user.role,
  };
}

export async function initializeAuth(store) {
  if (store.driver !== "postgresql") return;
  await store.pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (LOWER(email));
    CREATE INDEX IF NOT EXISTS users_role_active_idx ON users (role, is_active);

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_hash TEXT NOT NULL,
      user_agent TEXT NOT NULL DEFAULT '',
      ip_hash TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id, expires_at DESC);
    CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id, expires_at DESC);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip_hash TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);
    CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_user_id, created_at DESC);
  `);

  const { rows } = await store.pool.query("SELECT COUNT(*)::integer AS count FROM users");
  if (rows[0].count > 0) return;

  const email = normalizeEmail(process.env.SCAPELEAP_BOOTSTRAP_ADMIN_EMAIL);
  const password = process.env.SCAPELEAP_BOOTSTRAP_ADMIN_PASSWORD;
  if (!validateEmail(email) || !validatePassword(password)) {
    throw new Error("A strong SCAPELEAP_BOOTSTRAP_ADMIN_EMAIL/PASSWORD is required for the first PostgreSQL start.");
  }
  const passwordHash = await hashPassword(password);
  await store.pool.query(
    `INSERT INTO users
       (email, password_hash, display_name, first_name, role, is_email_verified, must_change_password)
     VALUES ($1, $2, $3, $4, 'owner', TRUE, TRUE)`,
    [email, passwordHash, process.env.SCAPELEAP_BOOTSTRAP_ADMIN_NAME || "构境管理员", "管理员"]
  );
}

export async function writeAudit(store, req, action, targetType, targetId, metadata = {}, actorId) {
  if (store.driver !== "postgresql") return;
  const auditSalt = process.env.SCAPELEAP_AUDIT_SALT || "local-development";
  await store.pool.query(
    `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata, ip_hash)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [
      actorId ?? req.authUser?.id ?? null,
      action,
      targetType ?? null,
      targetId ? String(targetId) : null,
      JSON.stringify(metadata),
      sha256(`${auditSalt}:${clientIp(req)}`),
    ]
  );
}

export async function authenticateRequest(store, req) {
  if (store.driver !== "postgresql") {
    req.authUser = LOCAL_USER;
    return LOCAL_USER;
  }
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const { rows } = await store.pool.query(
    `SELECT u.*, s.token_hash, s.csrf_hash, s.last_seen_at
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW()
       AND u.is_active = TRUE`,
    [sha256(token)]
  );
  const user = rows[0];
  if (!user) return null;
  req.authUser = user;
  req.authSession = { tokenHash: user.token_hash, csrfHash: user.csrf_hash };
  if (Date.now() - new Date(user.last_seen_at).getTime() > 5 * 60 * 1000) {
    void store.pool
      .query("UPDATE auth_sessions SET last_seen_at = NOW() WHERE token_hash = $1", [user.token_hash])
      .catch((error) => console.error("[auth-session-touch]", error));
  }
  return user;
}

export function isAdmin(user) {
  return user && ["owner", "admin"].includes(user.role);
}

export function workspaceRole(user) {
  if (!user) return 0;
  if (["owner", "admin"].includes(user.role)) return 20;
  if (user.role === "member") return 15;
  return 5;
}

export function requireUser(req, res) {
  if (req.authUser) return true;
  sendJson(req, res, 401, { detail: "Authentication credentials were not provided.", error: "unauthenticated" });
  return false;
}

export function requireAdmin(req, res) {
  if (!requireUser(req, res)) return false;
  if (isAdmin(req.authUser)) return true;
  sendJson(req, res, 403, { detail: "Administrator permission is required.", error: "forbidden" });
  return false;
}

function csrfFromRequest(req, body = {}) {
  return req.headers["x-csrftoken"] || req.headers["x-csrf-token"] || body.csrfmiddlewaretoken || body.csrf_token || "";
}

export function verifyCsrf(req, body = {}) {
  const cookies = parseCookies(req);
  const value = csrfFromRequest(req, body);
  if (!value || !cookies[CSRF_COOKIE] || !safeEqual(value, cookies[CSRF_COOKIE])) return false;
  if (req.authSession && sha256(value) !== req.authSession.csrfHash) return false;
  return true;
}

async function createSession(store, req, res, user) {
  const token = randomBytes(32).toString("base64url");
  const csrf = randomBytes(24).toString("base64url");
  const auditSalt = process.env.SCAPELEAP_AUDIT_SALT || "local-development";
  await store.pool.query("DELETE FROM auth_sessions WHERE expires_at <= NOW() OR revoked_at IS NOT NULL");
  await store.pool.query(
    `INSERT INTO auth_sessions
       (token_hash, user_id, csrf_hash, user_agent, ip_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')`,
    [sha256(token), user.id, sha256(csrf), userAgent(req), sha256(`${auditSalt}:${clientIp(req)}`)]
  );
  await store.pool.query(
    `UPDATE auth_sessions SET revoked_at = NOW()
     WHERE token_hash IN (
       SELECT token_hash FROM auth_sessions
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC OFFSET 10
     )`,
    [user.id]
  );
  res.setHeader("Set-Cookie", [
    cookie(SESSION_COOKIE, token, { httpOnly: true, maxAge: SESSION_TTL_SECONDS }),
    cookie(CSRF_COOKIE, csrf, { maxAge: SESSION_TTL_SECONDS }),
  ]);
}

async function ensureCsrf(store, req, res) {
  const existing = parseCookies(req)[CSRF_COOKIE];
  const value = existing || randomBytes(24).toString("base64url");
  if (!existing) {
    res.setHeader("Set-Cookie", cookie(CSRF_COOKIE, value, { maxAge: SESSION_TTL_SECONDS }));
    if (req.authSession && store.driver === "postgresql") {
      await store.pool.query("UPDATE auth_sessions SET csrf_hash = $1 WHERE token_hash = $2", [
        sha256(value),
        req.authSession.tokenHash,
      ]);
      req.authSession.csrfHash = sha256(value);
    }
  }
  return value;
}

async function sendResetEmail(user, token) {
  if (!process.env.SMTP_HOST) return false;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || "" } : undefined,
  });
  const uidb64 = Buffer.from(String(user.id)).toString("base64url");
  const link = `${PUBLIC_URL}/accounts/reset-password?uidb64=${uidb64}&token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: "重置构境AI密码",
    text: `请在 30 分钟内打开以下链接重置密码：\n${link}`,
    html: `<p>请在 30 分钟内重置构境AI密码：</p><p><a href="${link}">${link}</a></p>`,
  });
  return true;
}

export async function handleAuthRequest(store, req, res, path, method) {
  if (!path.startsWith("/auth")) return false;

  if (path === "/auth/get-csrf-token" && method === "GET") {
    return sendJson(req, res, 200, { csrf_token: await ensureCsrf(store, req, res) }) ?? true;
  }

  if (store.driver !== "postgresql") {
    if (method === "POST") return redirect(res, "/formscape") ?? true;
    return sendJson(req, res, 200, { success: true, local: true }) ?? true;
  }

  if (path === "/auth/email-check" && method === "POST") {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    if (!validateEmail(email)) return sendJson(req, res, 400, { error_code: "5005", error: "invalid_email" }) ?? true;
    const { rows } = await store.pool.query("SELECT id FROM users WHERE LOWER(email) = $1", [email]);
    return sendJson(req, res, 200, { existing: rows.length > 0, status: "CREDENTIAL" }) ?? true;
  }

  if (path === "/auth/sign-in" && method === "POST") {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    if (!verifyCsrf(req, body)) return authError(req, res, "5065", email, 403) ?? true;
    const { rows } = await store.pool.query("SELECT * FROM users WHERE LOWER(email) = $1", [email]);
    const user = rows[0];
    const locked = user?.locked_until && new Date(user.locked_until).getTime() > Date.now();
    const valid = user && user.is_active && !locked && (await verifyPassword(body.password, user.password_hash));
    if (!valid) {
      if (user && !locked) {
        await store.pool.query(
          `UPDATE users SET
             failed_login_attempts = failed_login_attempts + 1,
             locked_until = CASE
               WHEN failed_login_attempts + 1 >= $2 THEN NOW() + ($3 || ' minutes')::interval
               ELSE locked_until
             END,
             updated_at = NOW()
           WHERE id = $1`,
          [user.id, MAX_FAILED_LOGINS, LOCK_MINUTES]
        );
      }
      await writeAudit(store, req, "auth.login_failed", "user", user?.id, { email, locked: Boolean(locked) }, user?.id);
      return authError(req, res, locked ? "5900" : "5065", email, 401) ?? true;
    }
    await store.pool.query(
      "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW() WHERE id = $1",
      [user.id]
    );
    await createSession(store, req, res, user);
    await writeAudit(store, req, "auth.login_succeeded", "user", user.id, {}, user.id);
    const nextPath = String(body.next_path || "/formscape");
    return wantsJson(req)
      ? (sendJson(req, res, 200, { success: true, user: publicUser(user), next_path: nextPath }) ?? true)
      : (redirect(res, nextPath.startsWith("/") ? nextPath : "/formscape") ?? true);
  }

  if (path === "/auth/sign-up" && method === "POST") {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    if (!verifyCsrf(req, body)) return authError(req, res, "5035", email, 403, "/sign-up") ?? true;
    if (String(process.env.SCAPELEAP_SIGNUP_ENABLED || "false") !== "true") {
      return authError(req, res, "5015", email, 403, "/sign-up") ?? true;
    }
    if (!validateEmail(email) || !validatePassword(body.password)) {
      return authError(req, res, !validateEmail(email) ? "5045" : "5021", email, 400, "/sign-up") ?? true;
    }
    const passwordHash = await hashPassword(body.password);
    try {
      const displayName = String(body.display_name || email.split("@")[0]).slice(0, 100);
      const { rows } = await store.pool.query(
        `INSERT INTO users
           (email, password_hash, display_name, role, is_email_verified)
         VALUES ($1, $2, $3, 'member', FALSE)
         RETURNING *`,
        [email, passwordHash, displayName]
      );
      const user = rows[0];
      await createSession(store, req, res, user);
      await writeAudit(store, req, "auth.signup_succeeded", "user", user.id, {}, user.id);
      return redirect(res, "/formscape") ?? true;
    } catch (error) {
      if (error?.code === "23505") return authError(req, res, "5030", email, 409, "/sign-up") ?? true;
      throw error;
    }
  }

  if (path === "/auth/sign-out" && method === "POST") {
    const body = await readBody(req);
    if (!verifyCsrf(req, body)) return sendJson(req, res, 403, { error: "csrf_failed" }) ?? true;
    if (req.authSession) {
      await store.pool.query("UPDATE auth_sessions SET revoked_at = NOW() WHERE token_hash = $1", [
        req.authSession.tokenHash,
      ]);
      await writeAudit(store, req, "auth.logout", "user", req.authUser?.id);
    }
    res.setHeader("Set-Cookie", [
      cookie(SESSION_COOKIE, "", { httpOnly: true, maxAge: 0 }),
      cookie(CSRF_COOKIE, "", { maxAge: 0 }),
    ]);
    return redirect(res, "/") ?? true;
  }

  if (path === "/auth/forgot-password" && method === "POST") {
    const body = await readBody(req);
    if (!verifyCsrf(req, body)) return sendJson(req, res, 403, { error: "csrf_failed" }) ?? true;
    const email = normalizeEmail(body.email);
    const { rows } = await store.pool.query("SELECT * FROM users WHERE LOWER(email) = $1 AND is_active = TRUE", [
      email,
    ]);
    const user = rows[0];
    let delivered = false;
    if (user) {
      const token = randomBytes(32).toString("base64url");
      await store.pool.query(
        `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
        [sha256(token), user.id]
      );
      delivered = await sendResetEmail(user, token);
      await writeAudit(store, req, "auth.password_reset_requested", "user", user.id, { delivered }, user.id);
    }
    return (
      sendJson(req, res, 200, {
        success: true,
        message: "If the account exists, password reset instructions will be sent.",
      }) ?? true
    );
  }

  const resetMatch = path.match(/^\/auth\/reset-password\/([^/]+)\/([^/]+)$/);
  if (resetMatch && method === "POST") {
    const body = await readBody(req);
    if (!verifyCsrf(req, body)) return authError(req, res, "5125", "", 403, "/accounts/reset-password") ?? true;
    const tokenHash = sha256(decodeURIComponent(resetMatch[2]));
    const { rows } = await store.pool.query(
      `SELECT t.*, u.email FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $1 AND t.used_at IS NULL`,
      [tokenHash]
    );
    const reset = rows[0];
    if (!reset) return authError(req, res, "5125", "", 400, "/accounts/reset-password") ?? true;
    if (new Date(reset.expires_at).getTime() <= Date.now()) {
      return authError(req, res, "5130", reset.email, 400, "/accounts/reset-password") ?? true;
    }
    if (!validatePassword(body.password)) {
      return authError(req, res, "5021", reset.email, 400, "/accounts/reset-password") ?? true;
    }
    const passwordHash = await hashPassword(body.password);
    const client = await store.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2",
        [passwordHash, reset.user_id]
      );
      await client.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1", [tokenHash]);
      await client.query("UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1", [reset.user_id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await writeAudit(store, req, "auth.password_reset_completed", "user", reset.user_id, {}, reset.user_id);
    return redirect(res, `/?email=${encodeURIComponent(reset.email)}`) ?? true;
  }

  if ((path === "/auth/change-password" || path === "/auth/set-password") && method === "POST") {
    if (!requireUser(req, res)) return true;
    const body = await readBody(req);
    if (!verifyCsrf(req, body)) return sendJson(req, res, 403, { error: "csrf_failed" }) ?? true;
    const password = body.new_password || body.password;
    if (!validatePassword(password)) return sendJson(req, res, 400, { error_code: "5140" }) ?? true;
    if (path === "/auth/change-password" && !(await verifyPassword(body.old_password, req.authUser.password_hash))) {
      return sendJson(req, res, 400, { error_code: "5135" }) ?? true;
    }
    await store.pool.query(
      "UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2",
      [await hashPassword(password), req.authUser.id]
    );
    await store.pool.query("UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND token_hash <> $2", [
      req.authUser.id,
      req.authSession.tokenHash,
    ]);
    await writeAudit(store, req, "auth.password_changed", "user", req.authUser.id);
    return sendJson(req, res, 200, publicUser({ ...req.authUser, must_change_password: false })) ?? true;
  }

  return sendJson(req, res, 404, { error: "auth_route_not_found" }) ?? true;
}
