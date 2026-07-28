/**
 * 构境业务数据路由（/api/fs/*）——SQLite 持久化（fs-db.mjs）。
 * 形状：
 *   GET    /api/fs/:entity            → 全量列表
 *   GET    /api/fs/:entity/:id        → 单条
 *   PUT    /api/fs/:entity/:id        → upsert（body = 文档 JSON）
 *   POST   /api/fs/:entity/_replace   → 整体替换（body = 文档数组）
 *   DELETE /api/fs/:entity/:id        → 删除
 *   POST   /api/fs/_reseed            → 重播种子（开发/测试）
 *   GET    /api/fs/_health            → { ok, db, counts }
 */
import { ENTITIES, getDoc, listDocs, openFsDb, putDoc, deleteDoc, replaceDocs, reseedFsDb } from "./fs-db.mjs";

let db = null;
export function getFsDb() {
  if (!db) db = openFsDb();
  return db;
}

function sendJson(req, res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": req.headers.origin || "*",
    "access-control-allow-credentials": "true",
  });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export async function handleFsRequest(req, res, pathname, method) {
  const d = getFsDb();
  const parts = pathname.replace(/^\/api\/fs\/?/, "").split("/").filter(Boolean);

  if (parts[0] === "_health" && method === "GET") {
    const counts = Object.fromEntries(ENTITIES.map((e) => [e, listDocs(d, e).length]));
    return sendJson(req, res, 200, { ok: true, driver: "node:sqlite", counts });
  }
  if (parts[0] === "_reseed" && method === "POST") {
    reseedFsDb(d);
    return sendJson(req, res, 200, { ok: true, reseeded: true });
  }

  const [entity, id] = parts;
  if (!ENTITIES.includes(entity)) {
    return sendJson(req, res, 404, { error: "unknown_entity", entity, allowed: ENTITIES });
  }

  try {
    if (method === "GET" && !id) return sendJson(req, res, 200, listDocs(d, entity));
    if (method === "GET" && id) {
      const doc = getDoc(d, entity, id);
      return doc ? sendJson(req, res, 200, doc) : sendJson(req, res, 404, { error: "not_found" });
    }
    if (method === "PUT" && id) {
      const body = await readBody(req);
      if (!body || typeof body !== "object") return sendJson(req, res, 400, { error: "bad_body" });
      const doc = { ...body, id: body.id ?? id };
      putDoc(d, entity, id, doc);
      return sendJson(req, res, 200, { ok: true, doc });
    }
    if (method === "POST" && id === "_replace") {
      const body = await readBody(req);
      if (!Array.isArray(body)) return sendJson(req, res, 400, { error: "bad_body_expected_array" });
      const n = replaceDocs(d, entity, body);
      return sendJson(req, res, 200, { ok: true, count: n });
    }
    if (method === "DELETE" && id) {
      const ok = deleteDoc(d, entity, id);
      return sendJson(req, res, ok ? 200 : 404, { ok });
    }
    return sendJson(req, res, 405, { error: "method_not_allowed", method, pathname });
  } catch (e) {
    console.error("[fs-api]", method, pathname, e);
    return sendJson(req, res, 500, { error: "internal", message: String(e?.message ?? e) });
  }
}
