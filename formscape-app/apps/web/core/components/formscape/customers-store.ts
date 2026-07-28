/**
 * 客户主数据 + 业主 Portal 回执（Demo · SQLite 持久化）
 *
 * - 客户库：真源 = 服务端 SQLite（/api/fs/customers，种子由 fs-seed 首次播种）
 * - Portal：业主对「风格方向 / 效果图 / 选材清单 / 报价确认」四步的确认 / 驳回 + 批注，
 *   是业主仅有的写操作（红线：业主不进主 App，Portal 是唯一触点）
 */
import {
  ensureFsHydrated,
  readFsCache,
  registerFsEntity,
  replaceFsDocs,
} from "./fs-data-client";
import {
  PORTAL_STEPS,
  defaultPortalState,
  type PortalProjectState,
  type PortalStepKey,
  type PortalStepStatus,
} from "./portal-api";

export {
  PORTAL_STEPS,
  portalStatusLabel,
  portalStatusTone,
  type PortalProjectState,
  type PortalStepKey,
  type PortalStepStatus,
} from "./portal-api";

/* ============================== 客户主数据 ============================== */

export const CUSTOMER_STAGES = ["线索", "量房", "方案", "施工", "已交付"] as const;
export type CustomerStage = (typeof CUSTOMER_STAGES)[number];

export const CUSTOMER_SOURCES = ["朋友介绍", "老客户转介绍", "小红书", "抖音", "线下活动", "其他"] as const;

export type CustomerNote = {
  id: string;
  text: string;
  /** ISO 时间 */
  at: string;
};

export type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  wechat: string;
  source: string;
  city: string;
  stage: CustomerStage;
  /** 预算（万），可为空 */
  budgetWan?: number;
  /** 关联项目（Demo：来自 pm-mock 项目列表，展示级） */
  projectIds: string[];
  /** 备注时间线（新的在前） */
  notes: CustomerNote[];
  createdAt: string;
  updatedAt: string;
};

/** 跨组件同步：客户页写入后，L2 徽标等可监听刷新 */
export const CUSTOMERS_CHANGE_EVENT = "fs-customers-change";

registerFsEntity("customers", CUSTOMERS_CHANGE_EVENT);
registerFsEntity("portal_state", CUSTOMERS_CHANGE_EVENT);
ensureFsHydrated(["customers", "portal_state"]);

function emitCustomersChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CUSTOMERS_CHANGE_EVENT));
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function stageOrValue(v: string): CustomerStage {
  return (CUSTOMER_STAGES as readonly string[]).includes(v) ? (v as CustomerStage) : "线索";
}

function loadCustomers(): CustomerRecord[] {
  return readFsCache<CustomerRecord>("customers");
}

function saveCustomers(list: CustomerRecord[]) {
  replaceFsDocs("customers", list);
}

export function getCustomers(): CustomerRecord[] {
  return loadCustomers();
}

export function getCustomerById(id: string): CustomerRecord | undefined {
  return loadCustomers().find((c) => c.id === id);
}

export type CustomerDraft = {
  name: string;
  phone: string;
  wechat: string;
  source: string;
  city: string;
  stage: CustomerStage;
  budgetWan?: number;
  /** 首条备注（可空） */
  note?: string;
};

export function createCustomer(draft: CustomerDraft): CustomerRecord {
  const now = new Date().toISOString();
  const record: CustomerRecord = {
    id: makeId("c"),
    name: draft.name.trim(),
    phone: draft.phone.trim(),
    wechat: draft.wechat.trim(),
    source: draft.source,
    city: draft.city.trim(),
    stage: draft.stage,
    budgetWan: draft.budgetWan,
    projectIds: [],
    notes: draft.note?.trim() ? [{ id: makeId("n"), text: draft.note.trim(), at: now }] : [],
    createdAt: now,
    updatedAt: now,
  };
  const list = [record, ...loadCustomers()];
  saveCustomers(list);
  emitCustomersChange();
  return record;
}

export function updateCustomer(id: string, patch: Partial<CustomerDraft>): CustomerRecord | undefined {
  const list = loadCustomers();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return undefined;
  const cur = list[idx];
  const next: CustomerRecord = {
    ...cur,
    name: patch.name !== undefined ? patch.name.trim() : cur.name,
    phone: patch.phone !== undefined ? patch.phone.trim() : cur.phone,
    wechat: patch.wechat !== undefined ? patch.wechat.trim() : cur.wechat,
    source: patch.source ?? cur.source,
    city: patch.city !== undefined ? patch.city.trim() : cur.city,
    stage: patch.stage ?? cur.stage,
    budgetWan: patch.budgetWan !== undefined ? patch.budgetWan : cur.budgetWan,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = next;
  saveCustomers(list);
  emitCustomersChange();
  return next;
}

export function deleteCustomer(id: string): void {
  const list = loadCustomers().filter((c) => c.id !== id);
  saveCustomers(list);
  emitCustomersChange();
}

export function addCustomerNote(id: string, text: string): CustomerRecord | undefined {
  const trimmed = text.trim();
  if (!trimmed) return getCustomerById(id);
  const list = loadCustomers();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return undefined;
  const now = new Date().toISOString();
  list[idx] = {
    ...list[idx],
    notes: [{ id: makeId("n"), text: trimmed, at: now }, ...list[idx].notes],
    updatedAt: now,
  };
  saveCustomers(list);
  emitCustomersChange();
  return list[idx];
}

/** 切换客户与项目的关联（Demo：项目来自 pm-mock，展示级） */
export function toggleCustomerProject(id: string, projectId: string): CustomerRecord | undefined {
  const list = loadCustomers();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return undefined;
  const cur = list[idx];
  const projectIds = cur.projectIds.includes(projectId)
    ? cur.projectIds.filter((p) => p !== projectId)
    : [...cur.projectIds, projectId];
  list[idx] = { ...cur, projectIds, updatedAt: new Date().toISOString() };
  saveCustomers(list);
  emitCustomersChange();
  return list[idx];
}

/** 按阶段计数（L2 筛选徽标 / 页内胶囊用） */
export function countCustomersByStage(): Record<CustomerStage | "全部", number> {
  const list = loadCustomers();
  const map = { 全部: list.length } as Record<CustomerStage | "全部", number>;
  CUSTOMER_STAGES.forEach((s) => {
    map[s] = list.filter((c) => c.stage === s).length;
  });
  return map;
}

/* ============================== 业主 Portal 回执 ============================== */

export const PORTAL_CHANGE_EVENT = "fs-client-portal-change";

function emitPortalChange(projectId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PORTAL_CHANGE_EVENT, { detail: { projectId } }));
}

type PortalDoc = PortalProjectState & { id: string };

function loadPortalAll(): Record<string, PortalProjectState> {
  const map: Record<string, PortalProjectState> = {};
  for (const d of readFsCache<PortalDoc>("portal_state")) {
    const { id, ...state } = d;
    map[id] = state;
  }
  return map;
}

function savePortalAll(map: Record<string, PortalProjectState>) {
  replaceFsDocs(
    "portal_state",
    Object.entries(map).map(([id, state]) => ({ id, ...state }))
  );
}

export function getPortalState(projectId: string): PortalProjectState {
  const all = loadPortalAll();
  return { ...defaultPortalState(), ...(all[projectId] ?? {}) };
}

/** 业主写操作：确认 / 驳回（+批注）。这是业主仅有的写入口 */
export function setPortalStep(
  projectId: string,
  step: PortalStepKey,
  status: PortalStepStatus,
  comment?: string
): PortalProjectState {
  const all = loadPortalAll();
  const cur = { ...defaultPortalState(), ...(all[projectId] ?? {}) };
  cur[step] = {
    status,
    comment: status === "rejected" ? comment?.trim() || undefined : undefined,
    at: new Date().toISOString(),
  };
  all[projectId] = cur;
  savePortalAll(all);
  emitPortalChange(projectId);
  return cur;
}

/** Portal 摘要：n/4 已确认，是否有驳回（客户详情侧展示用） */
export function getPortalSummary(projectId: string) {
  const state = getPortalState(projectId);
  const confirmed = PORTAL_STEPS.filter((s) => state[s.key].status === "confirmed").length;
  const rejected = PORTAL_STEPS.filter((s) => state[s.key].status === "rejected").length;
  return { confirmed, rejected, total: PORTAL_STEPS.length, state };
}
