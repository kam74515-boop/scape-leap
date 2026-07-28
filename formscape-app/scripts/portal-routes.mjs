/**
 * 业主 Portal 的服务端安全边界。
 *
 * - 工作台生成随机分享令牌；SQLite 仅保存 SHA-256 摘要。
 * - 公共读取/确认必须同时匹配 projectId + token，支持过期与撤销。
 * - 公共响应只返回 Portal 所需的最小项目字段，不暴露客户库或工作室数据。
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getDoc, listDocs, putDoc } from "./fs-db.mjs";
import { getFsDb } from "./fs-routes.mjs";

const PORTAL_STEPS = ["style", "render", "materials", "quote"];

function sendJson(req, res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
    "access-control-allow-origin": req.headers.origin || "*",
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization, X-CSRFToken, X-Requested-With",
  });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function tokenMatches(token, expectedHash) {
  const actual = Buffer.from(tokenHash(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function defaultPortalState() {
  return {
    style: { status: "pending" },
    render: { status: "pending" },
    materials: { status: "pending" },
    quote: { status: "pending" },
  };
}

function readShare(db, projectId) {
  return db
    .prepare(
      "SELECT project_id, token_hash, created_at, expires_at, revoked_at FROM portal_shares WHERE project_id = ?"
    )
    .get(projectId);
}

function validateShare(db, projectId, token) {
  const share = readShare(db, projectId);
  if (!share || !tokenMatches(token, share.token_hash)) return { ok: false, status: 404, reason: "invalid" };
  if (share.revoked_at) return { ok: false, status: 410, reason: "revoked" };
  if (Date.parse(share.expires_at) <= Date.now()) return { ok: false, status: 410, reason: "expired" };
  return { ok: true, share };
}

function publicProject(project) {
  return {
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    city: project.city,
    houseType: project.houseType,
    budgetWan: project.budgetWan,
    designFeeWan: project.designFeeWan,
    stageLabel: project.stageLabel,
  };
}

function portalPayload(db, projectId) {
  const project = getDoc(db, "projects", projectId);
  if (!project) return null;
  const saved = getDoc(db, "portal_state", projectId);
  const state = { ...defaultPortalState(), ...(saved ?? {}) };
  delete state.id;
  const style = getDoc(db, "style_stage", projectId);
  const styles = (style?.directions ?? []).map((direction) => ({
    id: direction.id,
    name: direction.name,
    desc: direction.desc,
    image: direction.image,
    colors: direction.colors ?? [],
    selected: direction.id === style?.selectedId,
  }));
  const renders = listDocs(db, "render_stage")
    .filter((render) => render.projectId === projectId)
    .map((render) => ({
      id: render.id,
      src: render.src,
      name: render.skillName || "项目效果图",
    }));
  const materials = listDocs(db, "purchase_lines")
    .filter((line) => line.projectId === projectId && line.status !== "cancelled")
    .map((line) => ({
      id: line.id,
      name: line.name,
      brand: line.brand,
      category: line.category,
      qty: line.qty,
      price: line.price,
    }));
  const files = listDocs(db, "files")
    .filter((file) => file.projectId === projectId && file.portalVisible && file.contentDataUrl)
    .map((file) => ({
      id: file.id,
      name: file.name,
      kind: file.kind,
      mime: file.mime,
      sizeLabel: file.sizeLabel,
      contentDataUrl: file.contentDataUrl,
    }));
  return {
    project: publicProject(project),
    state,
    deliverables: { styles, renders, materials, files },
  };
}

export async function handlePortalRequest(req, res, pathname, method) {
  const db = getFsDb();
  const shareMatch = pathname.match(/^\/api\/portal-shares\/([^/]+)$/);
  const publicMatch = pathname.match(/^\/api\/public\/portal\/([^/]+)\/([^/]+)(?:\/steps\/([^/]+))?$/);

  try {
    if (shareMatch) {
      const projectId = decodeURIComponent(shareMatch[1]);
      const project = getDoc(db, "projects", projectId);
      if (!project) return sendJson(req, res, 404, { error: "project_not_found" });

      if (method === "POST") {
        const body = (await readBody(req)) ?? {};
        const ttlDays = Math.max(1, Math.min(90, Number(body.ttlDays) || 30));
        const token = randomBytes(24).toString("base64url");
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + ttlDays * 86_400_000).toISOString();
        db.prepare(
          `INSERT OR REPLACE INTO portal_shares
             (project_id, token_hash, created_at, expires_at, revoked_at)
           VALUES (?, ?, ?, ?, NULL)`
        ).run(projectId, tokenHash(token), createdAt, expiresAt);
        return sendJson(req, res, 201, { projectId, token, createdAt, expiresAt });
      }

      const share = readShare(db, projectId);
      if (method === "GET") {
        if (!share) return sendJson(req, res, 404, { error: "share_not_found" });
        return sendJson(req, res, 200, {
          projectId,
          createdAt: share.created_at,
          expiresAt: share.expires_at,
          revokedAt: share.revoked_at,
          active: !share.revoked_at && Date.parse(share.expires_at) > Date.now(),
        });
      }
      if (method === "DELETE") {
        if (!share) return sendJson(req, res, 404, { error: "share_not_found" });
        const revokedAt = new Date().toISOString();
        db.prepare("UPDATE portal_shares SET revoked_at = ? WHERE project_id = ?").run(revokedAt, projectId);
        return sendJson(req, res, 200, { ok: true, projectId, revokedAt });
      }
      return sendJson(req, res, 405, { error: "method_not_allowed" });
    }

    if (publicMatch) {
      const projectId = decodeURIComponent(publicMatch[1]);
      const token = publicMatch[2];
      const step = publicMatch[3];
      const valid = validateShare(db, projectId, token);
      if (!valid.ok) return sendJson(req, res, valid.status, { error: "portal_link_unavailable", reason: valid.reason });

      if (method === "GET" && !step) {
        const payload = portalPayload(db, projectId);
        return payload
          ? sendJson(req, res, 200, payload)
          : sendJson(req, res, 404, { error: "project_not_found" });
      }

      if (method === "PATCH" && step) {
        if (!PORTAL_STEPS.includes(step)) return sendJson(req, res, 400, { error: "invalid_step" });
        const body = (await readBody(req)) ?? {};
        if (!["confirmed", "rejected"].includes(body.status)) {
          return sendJson(req, res, 400, { error: "invalid_status" });
        }
        const comment = typeof body.comment === "string" ? body.comment.trim() : "";
        if (body.status === "rejected" && !comment) {
          return sendJson(req, res, 400, { error: "comment_required" });
        }

        const payload = portalPayload(db, projectId);
        if (!payload) return sendJson(req, res, 404, { error: "project_not_found" });
        payload.state[step] = {
          status: body.status,
          comment: body.status === "rejected" ? comment : undefined,
          at: new Date().toISOString(),
        };
        putDoc(db, "portal_state", projectId, { id: projectId, ...payload.state });
        return sendJson(req, res, 200, payload);
      }
      return sendJson(req, res, 405, { error: "method_not_allowed" });
    }

    return sendJson(req, res, 404, { error: "not_found" });
  } catch (error) {
    console.error("[portal-api]", method, pathname, error);
    return sendJson(req, res, 500, { error: "internal", message: String(error?.message ?? error) });
  }
}
