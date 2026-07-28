/**
 * 构境后台管理 API：总览、用户、角色、会话和审计。
 * 所有路由要求 owner/admin 会话；所有写操作额外校验 CSRF。
 */
import { randomBytes } from "node:crypto";
import {
  hashPassword,
  normalizeEmail,
  publicUser,
  readBody,
  requireAdmin,
  validateEmail,
  verifyCsrf,
  writeAudit,
} from "./auth.mjs";
import { countDocs } from "./data-store.mjs";

const ROLES = new Set(["owner", "admin", "member", "viewer"]);

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
    "Cache-Control": "no-store",
  });
  res.end(data);
}

function temporaryPassword() {
  return `Fs!${randomBytes(18).toString("base64url")}9aA`;
}

function adminUser(row) {
  return {
    ...publicUser(row),
    role: row.role,
    must_change_password: row.must_change_password,
    failed_login_attempts: row.failed_login_attempts,
    locked_until: row.locked_until,
    last_login_at: row.last_login_at,
    active_sessions: Number(row.active_sessions || 0),
  };
}

async function lastActiveOwner(store) {
  const { rows } = await store.pool.query(
    "SELECT COUNT(*)::integer AS count FROM users WHERE role = 'owner' AND is_active = TRUE"
  );
  return rows[0].count <= 1;
}

export async function handleAdminRequest(store, req, res, path, method, url) {
  if (!path.startsWith("/api/admin")) return false;
  if (!requireAdmin(req, res)) return true;
  if (store.driver !== "postgresql") {
    sendJson(res, 503, { error: "postgresql_required" });
    return true;
  }

  if (path === "/api/admin/overview" && method === "GET") {
    const [users, sessions, audit, database, extensions, entities] = await Promise.all([
      store.pool.query(
        `SELECT
           COUNT(*)::integer AS total,
           COUNT(*) FILTER (WHERE is_active)::integer AS active,
           COUNT(*) FILTER (WHERE role IN ('owner', 'admin') AND is_active)::integer AS admins
         FROM users`
      ),
      store.pool.query(
        "SELECT COUNT(*)::integer AS active FROM auth_sessions WHERE revoked_at IS NULL AND expires_at > NOW()"
      ),
      store.pool.query(
        "SELECT COUNT(*)::integer AS last_24h FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours'"
      ),
      store.pool.query(
        "SELECT pg_database_size(current_database())::bigint AS bytes, current_database() AS name, version() AS version"
      ),
      store.pool.query(
        "SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'pgcrypto') ORDER BY extname"
      ),
      countDocs(store),
    ]);
    sendJson(res, 200, {
      users: users.rows[0],
      sessions: sessions.rows[0],
      audit: audit.rows[0],
      database: {
        ...database.rows[0],
        bytes: Number(database.rows[0].bytes),
        extensions: extensions.rows,
      },
      entities,
      auth: {
        signup_enabled: String(process.env.SCAPELEAP_SIGNUP_ENABLED || "false") === "true",
        smtp_configured: Boolean(process.env.SMTP_HOST),
        session_ttl_days: 7,
      },
    });
    return true;
  }

  if (path === "/api/admin/users" && method === "GET") {
    const search = String(url.searchParams.get("search") || "").trim();
    const role = String(url.searchParams.get("role") || "");
    const status = String(url.searchParams.get("status") || "");
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")) || 100));
    const { rows } = await store.pool.query(
      `SELECT u.*,
         COUNT(s.token_hash) FILTER (WHERE s.revoked_at IS NULL AND s.expires_at > NOW())::integer AS active_sessions
       FROM users u
       LEFT JOIN auth_sessions s ON s.user_id = u.id
       WHERE ($1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.display_name ILIKE '%' || $1 || '%')
         AND ($2 = '' OR u.role = $2)
         AND ($3 = '' OR ($3 = 'active' AND u.is_active) OR ($3 = 'inactive' AND NOT u.is_active))
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $4`,
      [search, ROLES.has(role) ? role : "", status, limit]
    );
    sendJson(res, 200, { users: rows.map(adminUser), count: rows.length });
    return true;
  }

  if (path === "/api/admin/users" && method === "POST") {
    const body = await readBody(req);
    if (!verifyCsrf(req, body)) return sendJson(res, 403, { error: "csrf_failed" }) ?? true;
    const email = normalizeEmail(body.email);
    const role = ROLES.has(body.role) ? body.role : "member";
    if (!validateEmail(email)) return sendJson(res, 400, { error: "invalid_email" }) ?? true;
    const password = temporaryPassword();
    try {
      const { rows } = await store.pool.query(
        `INSERT INTO users
           (email, password_hash, display_name, first_name, last_name, role, is_email_verified, must_change_password)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE)
         RETURNING *`,
        [
          email,
          await hashPassword(password),
          String(body.display_name || email.split("@")[0])
            .trim()
            .slice(0, 100),
          String(body.first_name || "")
            .trim()
            .slice(0, 80),
          String(body.last_name || "")
            .trim()
            .slice(0, 80),
          role,
        ]
      );
      await writeAudit(store, req, "admin.user_created", "user", rows[0].id, { email, role });
      sendJson(res, 201, { user: adminUser(rows[0]), temporary_password: password });
      return true;
    } catch (error) {
      if (error?.code === "23505") return sendJson(res, 409, { error: "email_exists" }) ?? true;
      throw error;
    }
  }

  const userMatch = path.match(/^\/api\/admin\/users\/([0-9a-f-]+)$/i);
  if (userMatch && method === "PATCH") {
    const body = await readBody(req);
    if (!verifyCsrf(req, body)) return sendJson(res, 403, { error: "csrf_failed" }) ?? true;
    const userId = userMatch[1];
    const { rows: currentRows } = await store.pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    const current = currentRows[0];
    if (!current) return sendJson(res, 404, { error: "user_not_found" }) ?? true;

    const nextRole = ROLES.has(body.role) ? body.role : current.role;
    const nextActive = typeof body.is_active === "boolean" ? body.is_active : current.is_active;
    if (current.id === req.authUser.id && !nextActive) {
      return sendJson(res, 400, { error: "cannot_deactivate_self" }) ?? true;
    }
    if (current.role === "owner" && (nextRole !== "owner" || !nextActive) && (await lastActiveOwner(store))) {
      return sendJson(res, 400, { error: "last_owner_required" }) ?? true;
    }

    const { rows } = await store.pool.query(
      `UPDATE users SET
         display_name = $2,
         role = $3,
         is_active = $4,
         failed_login_attempts = CASE WHEN $4 THEN failed_login_attempts ELSE 0 END,
         locked_until = CASE WHEN $4 THEN locked_until ELSE NULL END,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        userId,
        String(body.display_name ?? current.display_name)
          .trim()
          .slice(0, 100),
        nextRole,
        nextActive,
      ]
    );
    if (!nextActive) {
      await store.pool.query("UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1", [userId]);
    }
    await writeAudit(store, req, "admin.user_updated", "user", userId, {
      role: nextRole,
      is_active: nextActive,
    });
    sendJson(res, 200, { user: adminUser(rows[0]) });
    return true;
  }

  const resetMatch = path.match(/^\/api\/admin\/users\/([0-9a-f-]+)\/reset-password$/i);
  if (resetMatch && method === "POST") {
    const body = await readBody(req);
    if (!verifyCsrf(req, body)) return sendJson(res, 403, { error: "csrf_failed" }) ?? true;
    const password = temporaryPassword();
    const { rows } = await store.pool.query(
      `UPDATE users SET
         password_hash = $2,
         must_change_password = TRUE,
         failed_login_attempts = 0,
         locked_until = NULL,
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, email`,
      [resetMatch[1], await hashPassword(password)]
    );
    if (!rows[0]) return sendJson(res, 404, { error: "user_not_found" }) ?? true;
    await store.pool.query("UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1", [resetMatch[1]]);
    await writeAudit(store, req, "admin.password_reset", "user", resetMatch[1], { email: rows[0].email });
    sendJson(res, 200, { temporary_password: password });
    return true;
  }

  const revokeMatch = path.match(/^\/api\/admin\/users\/([0-9a-f-]+)\/sessions\/revoke$/i);
  if (revokeMatch && method === "POST") {
    const body = await readBody(req);
    if (!verifyCsrf(req, body)) return sendJson(res, 403, { error: "csrf_failed" }) ?? true;
    const result = await store.pool.query(
      "UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
      [revokeMatch[1]]
    );
    await writeAudit(store, req, "admin.sessions_revoked", "user", revokeMatch[1], {
      count: result.rowCount,
    });
    sendJson(res, 200, { revoked: result.rowCount });
    return true;
  }

  if (path === "/api/admin/audit-logs" && method === "GET") {
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")) || 100));
    const { rows } = await store.pool.query(
      `SELECT a.id, a.action, a.target_type, a.target_id, a.metadata, a.created_at,
              u.email AS actor_email, u.display_name AS actor_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_user_id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );
    sendJson(res, 200, { logs: rows });
    return true;
  }

  sendJson(res, 404, { error: "admin_route_not_found" });
  return true;
}
