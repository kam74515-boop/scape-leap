/**
 * 项目双轴进度状态（Demo · SQLite 持久化）
 * A 经营节点 · B 设计阶段三态 · 与设计费同源
 * 真源 = 服务端 SQLite（/api/fs/progress，种子由 fs-seed 首次播种）
 */
import { STAGES, type StageId } from "./types";
import { ensureFsHydrated, isFsHydrated, putFsDoc, readFsCache, registerFsEntity } from "./fs-data-client";
import { getProjectById, listProjects } from "./projects-store";

export type StageState = "not_started" | "in_progress" | "confirmed";
export type BizNodeStatus = "todo" | "current" | "done" | "blocked";

export type BizNodeDef = {
  id: string;
  label: string;
  /** 关联设计费占比 0-1（节点完成后计入已收） */
  feeShare: number;
};

export const BIZ_NODE_DEFS: BizNodeDef[] = [
  { id: "lead", label: "线索", feeShare: 0 },
  { id: "survey", label: "量房", feeShare: 0 },
  { id: "sign", label: "签约", feeShare: 0 },
  { id: "fee1", label: "首期款", feeShare: 0.4 },
  { id: "confirm", label: "方案确认", feeShare: 0 },
  { id: "fee2", label: "中期款", feeShare: 0.3 },
  { id: "handover", label: "施工交底", feeShare: 0 },
  { id: "final", label: "尾款/交付", feeShare: 0.3 },
];

export type ProjectProgressState = {
  stageStates: Record<StageId, StageState>;
  /** 当前设计阶段焦点（工作位置） */
  focusStage: StageId;
  /** 经营节点完成到的最大下标（含）；current = doneMax+1 */
  bizDoneMax: number;
  /** 设计费总额（万） */
  designFeeWan: number;
  /** 下游因回跳标记过期的阶段 */
  staleStages: StageId[];
  updatedAt: string;
};

/** 跨组件同步：概览/阶段页写入后，L2 徽标与仪表盘刷新 */
export const PROGRESS_CHANGE_EVENT = "fs-project-progress-change";

function emitProgressChange(projectId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROGRESS_CHANGE_EVENT, { detail: { projectId } }));
}

function defaultStageStates(focus: StageId): Record<StageId, StageState> {
  const idx = STAGES.findIndex((s) => s.id === focus);
  const map = {} as Record<StageId, StageState>;
  STAGES.forEach((s, i) => {
    if (i < idx) map[s.id] = "confirmed";
    else if (i === idx) map[s.id] = "in_progress";
    else map[s.id] = "not_started";
  });
  return map;
}

function seedForProject(projectId: string): ProjectProgressState {
  const pm = getProjectById(projectId);
  const focus = (pm?.stageId as StageId) || "requirements";
  const validFocus = STAGES.some((s) => s.id === focus) ? focus : "requirements";
  // Demo：经营进度与 mock risk 略对齐
  const bizDoneMax =
    projectId === "proj-demo-1" ? 3 : projectId === "proj-demo-2" ? 1 : projectId === "proj-demo-3" ? 0 : 0;
  return {
    stageStates: defaultStageStates(validFocus),
    focusStage: validFocus,
    bizDoneMax,
    designFeeWan: pm?.designFeeWan ?? 3.8,
    staleStages: [],
    updatedAt: new Date().toISOString(),
  };
}

type ProgressDoc = ProjectProgressState & { id: string };

registerFsEntity("progress", PROGRESS_CHANGE_EVENT);
ensureFsHydrated(["progress"]);

function loadAll(): Record<string, ProjectProgressState> {
  const map: Record<string, ProjectProgressState> = {};
  for (const d of readFsCache<ProgressDoc>("progress")) {
    const { id, ...state } = d;
    map[id] = state;
  }
  return map;
}

function saveAll(map: Record<string, ProjectProgressState>) {
  for (const [id, state] of Object.entries(map)) {
    putFsDoc("progress", { id, ...state });
  }
}

export function getProjectProgress(projectId: string): ProjectProgressState {
  const all = loadAll();
  if (!all[projectId]) {
    const seeded = seedForProject(projectId);
    // seed-on-miss 守卫：未 hydrate 前只在内存给种子，不写服务端（防覆盖）
    if (isFsHydrated("progress")) putFsDoc("progress", { id: projectId, ...seeded });
    all[projectId] = seeded;
  }
  return all[projectId];
}

export function setProjectProgress(projectId: string, next: ProjectProgressState) {
  const doc = { ...next, updatedAt: new Date().toISOString() };
  putFsDoc("progress", { id: projectId, ...doc });
  emitProgressChange(projectId);
  return doc;
}

/** 新建项目：需求分析显式进入进行中，经营轴仍停留在线索节点 */
export function initializeProjectProgress(projectId: string, designFeeWan: number): ProjectProgressState {
  const existing = readFsCache<ProgressDoc>("progress").find((doc) => doc.id === projectId);
  if (existing) {
    const { id: _id, ...state } = existing;
    return state;
  }
  return setProjectProgress(projectId, {
    stageStates: defaultStageStates("requirements"),
    focusStage: "requirements",
    bizDoneMax: -1,
    designFeeWan,
    staleStages: [],
    updatedAt: new Date().toISOString(),
  });
}

/** 进入某阶段：设为进行中（若未确认），并设为焦点 */
export function enterStage(projectId: string, stage: StageId): ProjectProgressState {
  const cur = getProjectProgress(projectId);
  const stageStates = { ...cur.stageStates };
  if (stageStates[stage] === "not_started") stageStates[stage] = "in_progress";
  return setProjectProgress(projectId, { ...cur, stageStates, focusStage: stage });
}

/** 确认阶段：当前 confirmed，清除该阶段 stale；若焦点仍在此则尝试推进焦点到下一未确认 */
export function confirmStage(projectId: string, stage: StageId): ProjectProgressState {
  const cur = getProjectProgress(projectId);
  const stageStates = { ...cur.stageStates, [stage]: "confirmed" as StageState };
  const staleStages = cur.staleStages.filter((s) => s !== stage);
  const idx = STAGES.findIndex((s) => s.id === stage);
  let focusStage = cur.focusStage;
  if (focusStage === stage) {
    const next = STAGES.slice(idx + 1).find((s) => stageStates[s.id] !== "confirmed");
    if (next) {
      focusStage = next.id;
      if (stageStates[next.id] === "not_started") stageStates[next.id] = "in_progress";
    }
  }
  return setProjectProgress(projectId, { ...cur, stageStates, staleStages, focusStage });
}

/**
 * 回跳到某阶段重新打开：该阶段 → 进行中，下游已确认 → 标记过期
 */
export function reopenStage(projectId: string, stage: StageId): ProjectProgressState {
  const cur = getProjectProgress(projectId);
  const idx = STAGES.findIndex((s) => s.id === stage);
  const stageStates = { ...cur.stageStates, [stage]: "in_progress" as StageState };
  const stale = new Set(cur.staleStages);
  STAGES.forEach((s, i) => {
    if (i > idx && stageStates[s.id] === "confirmed") stale.add(s.id);
  });
  return setProjectProgress(projectId, {
    ...cur,
    stageStates,
    focusStage: stage,
    staleStages: Array.from(stale),
  });
}

/** 推进经营节点到下一档（current 完成） */
export function advanceBizNode(projectId: string): ProjectProgressState {
  const cur = getProjectProgress(projectId);
  const next = Math.min(BIZ_NODE_DEFS.length - 1, cur.bizDoneMax + 1);
  return setProjectProgress(projectId, { ...cur, bizDoneMax: next });
}

export function setBizDoneMax(projectId: string, doneMax: number): ProjectProgressState {
  const cur = getProjectProgress(projectId);
  return setProjectProgress(projectId, {
    ...cur,
    bizDoneMax: Math.max(-1, Math.min(BIZ_NODE_DEFS.length - 1, doneMax)),
  });
}

export function getBizNodesView(projectId: string) {
  const { bizDoneMax } = getProjectProgress(projectId);
  return BIZ_NODE_DEFS.map((def, i) => ({
    ...def,
    status: (i <= bizDoneMax ? "done" : i === bizDoneMax + 1 ? "current" : "todo") as BizNodeStatus,
  }));
}

/** 设计费：已收 = 已完成经营节点 feeShare 之和 × 总额 */
export function getDesignFeeProgress(projectId: string) {
  const { bizDoneMax, designFeeWan } = getProjectProgress(projectId);
  const collectedShare = BIZ_NODE_DEFS.reduce(
    (sum, n, i) => sum + (i <= bizDoneMax ? n.feeShare : 0),
    0
  );
  const collectedWan = Number((designFeeWan * collectedShare).toFixed(2));
  const pendingWan = Number((designFeeWan - collectedWan).toFixed(2));
  return {
    designFeeWan,
    collectedWan,
    pendingWan,
    collectedShare,
    pct: Math.round(collectedShare * 100),
  };
}

export function stageStateLabel(s: StageState): string {
  if (s === "confirmed") return "已确认";
  if (s === "in_progress") return "进行中";
  return "未开始";
}

export function getStudioBizSnapshots() {
  return listProjects().map((p) => {
    const progress = getProjectProgress(p.id);
    const nodes = getBizNodesView(p.id);
    const fee = getDesignFeeProgress(p.id);
    const current = nodes.find((n) => n.status === "current");
    const confirmedStages = STAGES.filter((s) => progress.stageStates[s.id] === "confirmed").length;
    const designPct = Math.round((confirmedStages / STAGES.length) * 100);
    const focusMeta = STAGES.find((s) => s.id === progress.focusStage);
    return {
      projectId: p.id,
      projectName: p.name,
      nodes,
      fee,
      currentLabel: current?.label ?? "已交付",
      focusStage: progress.focusStage,
      focusStageLabel: focusMeta?.label ?? "—",
      designPct,
      confirmedStages,
      stageTotal: STAGES.length,
    };
  });
}

/** 设计阶段完成度（已确认 / 七段） */
export function getDesignStageProgress(projectId: string) {
  const { stageStates, focusStage, staleStages } = getProjectProgress(projectId);
  const confirmed = STAGES.filter((s) => stageStates[s.id] === "confirmed").length;
  return {
    confirmed,
    total: STAGES.length,
    pct: Math.round((confirmed / STAGES.length) * 100),
    focusStage,
    staleCount: staleStages.length,
  };
}
