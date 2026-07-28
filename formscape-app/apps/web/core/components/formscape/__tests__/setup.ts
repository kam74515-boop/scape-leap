/**
 * vitest setup：
 * 1. localStorage / window 最小 polyfill（仅剩 UI 偏好类使用）
 * 2. 启动真实 fs API（mock-api 同源路由 + SQLite :memory:），测试经 HTTP 驱动
 *    真实读写路径：store → fs-data-client → /api/fs/* → fs-routes → fs-db(SQLite)
 */
import http from "node:http";
// @ts-expect-error 路由层为纯 ESM .mjs（声明见 scripts/fs-routes.d.ts，tsc 不解析 .mjs 后缀映射）
import { handleFsRequest } from "../../../../../../scripts/fs-routes.mjs";
// @ts-expect-error 纯 ESM 测试路由
import { handlePortalRequest } from "../../../../../../scripts/portal-routes.mjs";

const _store = new Map<string, string>();

(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (_store.has(k) ? _store.get(k)! : null),
  setItem: (k: string, v: string) => {
    _store.set(k, String(v));
  },
  removeItem: (k: string) => {
    _store.delete(k);
  },
  clear: () => {
    _store.clear();
  },
  key: (i: number) => Array.from(_store.keys())[i] ?? null,
  get length() {
    return _store.size;
  },
} as Storage;

(globalThis as unknown as { window: Window }).window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  CustomEvent: class CustomEvent {
    type: string;
    constructor(t: string) {
      this.type = t;
    }
  },
  localStorage: (globalThis as unknown as { localStorage: Storage }).localStorage,
} as unknown as Window;

/* ---------- 真实 fs API 测试服务（SQLite 内存库） ---------- */

type FsTestGlobals = { __FS_TEST_SERVER?: http.Server; __FS_API_BASE?: string };
const g = globalThis as FsTestGlobals;

if (!g.__FS_TEST_SERVER) {
  process.env.FS_DB_PATH = ":memory:";
  const server = http.createServer((req, res) => {
    const u = new URL(req.url || "/", "http://127.0.0.1");
    if (u.pathname.startsWith("/api/fs/")) {
      return void handleFsRequest(req, res, u.pathname, (req.method || "GET").toUpperCase());
    }
    if (u.pathname.startsWith("/api/portal-shares/") || u.pathname.startsWith("/api/public/portal/")) {
      return void handlePortalRequest(req, res, u.pathname, (req.method || "GET").toUpperCase());
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  g.__FS_TEST_SERVER = server;
  g.__FS_API_BASE = `http://127.0.0.1:${port}`;
}

/** 测试间隔离：清空 localStorage 内存视图 */
export function resetStorage() {
  _store.clear();
}
