/**
 * 构境数据 API client — 业务数据唯一真源 = 服务端数据库（/api/fs/*）。
 *
 * 架构：生产 PostgreSQL、本地/测试 SQLite（mock-api.mjs → fs-routes.mjs → data-store.mjs）
 *   ↑ 本模块（薄 client：内存缓存 + 乐观写 + change 事件）
 *   ↑ 各 *-store（保持原有同步 API 与事件契约，UI 组件零改动）
 *
 * localStorage 只保留纯 UI 偏好（严格度滑杆、树展开、ML 开关等），不再是业务数据真源。
 */

export const FS_ENTITIES = [
  "tasks",
  "drafts",
  "drafts_hidden",
  "customers",
  "members",
  "projects",
  "purchase_lines",
  "style_boards",
  "style_stage",
  "render_stage",
  "progress",
  "space_scene",
  "canvas_docs",
  "ai_sessions",
  "ai_inbox",
  "files",
  "files_hidden",
  "construction",
  "extra_projects",
  "portal_state",
  "space_uploads",
  "demo_project",
  "gen_history",
  "canvas_boards",
] as const;

export type FsEntity = (typeof FS_ENTITIES)[number];

/* ---------- 缓存 / 事件 ---------- */

const cache = new Map<FsEntity, unknown[]>();
const entityEvents = new Map<string, string>();
const hydrateState = new Map<FsEntity, Promise<void> | "done">();
const pendingHydration = new Set<FsEntity>();
let dataAccess: "unknown" | "authenticated" | "unauthenticated" = (globalThis as { __FS_API_BASE?: string })
  .__FS_API_BASE
  ? "authenticated"
  : "unknown";

/** store 注册实体 → 变更事件名（沿用各 store 既有 CustomEvent，跨组件契约不变） */
export function registerFsEntity(entity: FsEntity, changeEvent: string) {
  entityEvents.set(entity, changeEvent);
}

function emit(entity: FsEntity) {
  if (typeof window === "undefined") return;
  const ev = entityEvents.get(entity);
  if (ev) window.dispatchEvent(new CustomEvent(ev));
}

/* ---------- HTTP ---------- */

function apiBase(): string {
  // 浏览器：同源（vite 把 /api 代理到 mock-api:8000）；vitest：setup 注入真实测试库地址
  const g = globalThis as { __FS_API_BASE?: string };
  if (g.__FS_API_BASE) return g.__FS_API_BASE;
  return "";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}/api/fs${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`fs-api ${path} → ${res.status}`);
  return (await res.json()) as T;
}

/* ---------- 读 ---------- */

/** 同步读缓存（首屏可能为空；hydrate 完成后经 change 事件触发重渲） */
export function readFsCache<T>(entity: FsEntity): T[] {
  return (cache.get(entity) ?? []) as T[];
}

/** 某实体是否已完成首次 hydrate（seed-on-miss 的守卫：未 hydrate 前不得把种子写回服务端） */
export function isFsHydrated(entity: FsEntity): boolean {
  return hydrateState.get(entity) === "done";
}

/** 后台 hydrate（幂等）；完成后发射各实体 change 事件 */
export function ensureFsHydrated(entities: FsEntity[]) {
  if (dataAccess !== "authenticated") {
    entities.forEach((entity) => pendingHydration.add(entity));
    return;
  }

  for (const entity of entities) {
    if (hydrateState.has(entity)) continue;
    const p = api<unknown[]>(`/${entity}`)
      .then((docs) => {
        cache.set(entity, docs);
        hydrateState.set(entity, "done");
        emit(entity);
        return undefined;
      })
      .catch((e) => {
        // 服务未起时静默降级为空缓存（可后续重试）；不阻断 UI
        hydrateState.delete(entity);
        console.warn(`[fs-data] hydrate ${entity} failed`, e);
      });
    hydrateState.set(entity, p);
  }
}

/**
 * 由登录态边界在用户查询完成后调用。这样公共页面不会抢跑 20+ 个需要会话的业务请求，
 * 已登录用户则会一次性补齐此前各 store 登记的实体。
 */
export function setFsDataAccess(authenticated: boolean) {
  dataAccess = authenticated ? "authenticated" : "unauthenticated";
  if (!authenticated || pendingHydration.size === 0) return;
  const entities = [...pendingHydration];
  pendingHydration.clear();
  ensureFsHydrated(entities);
}

/* ---------- 写（乐观缓存 + 服务端持久化） ---------- */

const pendingWrites = new Set<Promise<unknown>>();

function trackWrite(p: Promise<unknown>) {
  pendingWrites.add(p);
  void p.finally(() => pendingWrites.delete(p));
}

/** 等待所有进行中的乐观写落库（测试断言服务端状态前调用） */
export async function flushFsWrites() {
  await Promise.allSettled(pendingWrites);
}

/** upsert 单条：缓存先改 → PUT 落库；失败回滚缓存 */
export function putFsDoc<T extends { id: string }>(entity: FsEntity, doc: T): T {
  const list = readFsCache<T>(entity);
  const idx = list.findIndex((d) => d.id === doc.id);
  const next = idx >= 0 ? list.map((d) => (d.id === doc.id ? doc : d)) : [doc, ...list];
  const prev = list;
  cache.set(entity, next);
  emit(entity);
  trackWrite(
    api(`/${entity}/${encodeURIComponent(doc.id)}`, { method: "PUT", body: JSON.stringify(doc) }).catch((e) => {
      cache.set(entity, prev);
      emit(entity);
      console.warn(`[fs-data] put ${entity}/${doc.id} failed, rolled back`, e);
    })
  );
  return doc;
}

/** 删除单条（乐观） */
export function removeFsDoc(entity: FsEntity, id: string) {
  const prev = readFsCache<{ id: string }>(entity);
  cache.set(
    entity,
    prev.filter((d) => d.id !== id)
  );
  emit(entity);
  trackWrite(
    api(`/${entity}/${encodeURIComponent(id)}`, { method: "DELETE" }).catch((e) => {
      cache.set(entity, prev);
      emit(entity);
      console.warn(`[fs-data] delete ${entity}/${id} failed, rolled back`, e);
    })
  );
}

/** 整体替换集合（store 全量保存语义；乐观） */
export function replaceFsDocs<T>(entity: FsEntity, docs: T[]): T[] {
  const prev = cache.get(entity);
  cache.set(entity, docs);
  emit(entity);
  trackWrite(
    api(`/${entity}/_replace`, { method: "POST", body: JSON.stringify(docs) }).catch((e) => {
      if (prev) cache.set(entity, prev);
      emit(entity);
      console.warn(`[fs-data] replace ${entity} failed, rolled back`, e);
    })
  );
  return docs;
}

/* ---------- 测试支持 ---------- */

/** 测试专用：等所有进行中的 hydrate 结束（不 swallow 之外的错误） */
export async function flushFsHydration() {
  const pending = [...hydrateState.values()].filter((v): v is Promise<void> => v !== "done");
  await Promise.allSettled(pending);
}

/** 测试专用：服务端重播种子 + 清客户端缓存 + 全量重新 hydrate（确定性起点） */
export async function resetFsDataForTests() {
  dataAccess = "authenticated";
  await api("/_reseed", { method: "POST" });
  cache.clear();
  hydrateState.clear();
  pendingHydration.clear();
  ensureFsHydrated([...FS_ENTITIES]);
  await flushFsHydration();
}
