/**
 * 构境业务数据路由（/api/fs/*）——生产 PostgreSQL，本地 SQLite。
 * 形状：
 *   GET    /api/fs/:entity            → 全量列表
 *   GET    /api/fs/:entity/:id        → 单条
 *   PUT    /api/fs/:entity/:id        → upsert（body = 文档 JSON）
 *   POST   /api/fs/:entity/_replace   → 整体替换（body = 文档数组）
 *   DELETE /api/fs/:entity/:id        → 删除
 *   POST   /api/fs/_reseed            → 重播种子（开发/测试）
 *   GET    /api/fs/_health            → { ok, db, counts }
 */
import {
  ENTITIES,
  countDocs,
  deleteDoc,
  getDataStore,
  getDoc,
  listDocs,
  putDoc,
  replaceDocs,
  reseedDataStore,
} from "./data-store.mjs";

let storePromise = null;
export function getFsDb() {
  if (!storePromise) storePromise = getDataStore();
  return storePromise;
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
  const d = await getFsDb();
  const [entity, id] = pathname.replace(/^\/api\/fs\/?/, "").split("/");

  if (entity === "_health" && method === "GET") {
    const counts = await countDocs(d);
    return sendJson(req, res, 200, { ok: true, driver: d.driver, counts });
  }
  if (entity === "_reseed" && method === "POST") {
    await reseedDataStore(d);
    return sendJson(req, res, 200, { ok: true, reseeded: true });
  }

  if (!ENTITIES.includes(entity)) {
    return sendJson(req, res, 404, { error: "unknown_entity", entity, allowed: ENTITIES });
  }

  try {
    if (method === "GET" && !id) return sendJson(req, res, 200, await listDocs(d, entity));
    if (method === "GET" && id) {
      const doc = await getDoc(d, entity, id);
      return doc ? sendJson(req, res, 200, doc) : sendJson(req, res, 404, { error: "not_found" });
    }
    if (method === "PUT" && id) {
      const body = await readBody(req);
      if (!body || typeof body !== "object") return sendJson(req, res, 400, { error: "bad_body" });
      const doc = { ...body, id: body.id ?? id };
      await putDoc(d, entity, id, doc);
      return sendJson(req, res, 200, { ok: true, doc });
    }
    if (method === "POST" && id === "_replace") {
      const body = await readBody(req);
      if (!Array.isArray(body)) return sendJson(req, res, 400, { error: "bad_body_expected_array" });
      const n = await replaceDocs(d, entity, body);
      return sendJson(req, res, 200, { ok: true, count: n });
    }
    if (method === "DELETE" && id) {
      const ok = await deleteDoc(d, entity, id);
      return sendJson(req, res, ok ? 200 : 404, { ok });
    }
    return sendJson(req, res, 405, { error: "method_not_allowed", method, pathname });
  } catch (e) {
    console.error("[fs-api]", method, pathname, e);
    return sendJson(req, res, 500, { error: "internal", message: String(e?.message ?? e) });
  }
}
