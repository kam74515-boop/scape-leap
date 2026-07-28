/**
 * 施工阶段 Store（Demo · SQLite 持久化）
 * 验收清单勾选 + 变更留痕（新增变更自动生成计价差异草稿行）
 * 真源 = 服务端 SQLite（/api/fs/construction）
 */
import { useCallback, useEffect, useState } from "react";
import { ensureFsHydrated, readFsCache, registerFsEntity, replaceFsDocs } from "./fs-data-client";

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type ChangeRecord = {
  id: string;
  title: string;
  note: string;
  /** 计价差异（正=加项 负=减项，元） */
  amountDelta: number;
  /** yyyy-mm-dd */
  date: string;
  /** 演示级：变更一律先落草稿行 */
  status: "草稿";
};

type ConstructionState = {
  checklist: ChecklistItem[];
  changes: ChangeRecord[];
};

export const CONSTRUCTION_CHANGE_EVENT = "fs-construction-change";

registerFsEntity("construction", CONSTRUCTION_CHANGE_EVENT);
ensureFsHydrated(["construction"]);

const DEFAULT_CHECKLIST: Omit<ChecklistItem, "done">[] = [
  { id: "ck-1", label: "拆改交底（现场放线与保护）" },
  { id: "ck-2", label: "水电验收（打压 / 通电测试）" },
  { id: "ck-3", label: "泥木验收（瓦工平整度 / 木作收口）" },
  { id: "ck-4", label: "油漆验收（墙面观感 / 阴阳角）" },
  { id: "ck-5", label: "安装收尾验收（灯具洁具五金）" },
];

function seedState(): ConstructionState {
  return {
    checklist: DEFAULT_CHECKLIST.map((c) => ({ ...c, done: false })),
    changes: [
      {
        id: "chg-seed-1",
        title: "客厅顶面增加无主灯线槽",
        note: "客户确认后追加 · 影响油漆工期 2 天",
        amountDelta: 1800,
        date: "2026-07-20",
        status: "草稿",
      },
    ],
  };
}

type ConstructionDoc = ConstructionState & { id: string };

function loadAll(): Record<string, ConstructionState> {
  const map: Record<string, ConstructionState> = {};
  for (const d of readFsCache<ConstructionDoc>("construction")) {
    const { id, ...state } = d;
    map[id] = state;
  }
  return map;
}

function saveAll(map: Record<string, ConstructionState>, notify = true) {
  void notify; // 事件由 fs-data-client 统一发射
  replaceFsDocs("construction", Object.entries(map).map(([id, state]) => ({ id, ...state })));
}

export function getConstruction(projectId: string): ConstructionState {
  const all = loadAll();
  if (!all[projectId]) {
    all[projectId] = seedState();
    saveAll(all, false);
  }
  return all[projectId];
}

function update(projectId: string, fn: (s: ConstructionState) => ConstructionState) {
  const all = loadAll();
  const cur = all[projectId] ?? seedState();
  all[projectId] = fn(cur);
  saveAll(all);
  return all[projectId];
}

export function toggleChecklistItem(projectId: string, id: string) {
  update(projectId, (s) => ({
    ...s,
    checklist: s.checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)),
  }));
}

export function addChangeRecord(
  projectId: string,
  input: { title: string; note: string; amountDelta: number }
): ChangeRecord {
  const rec: ChangeRecord = {
    id: `chg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: input.title.trim() || "未命名变更",
    note: input.note.trim(),
    amountDelta: Math.round(input.amountDelta || 0),
    date: new Date().toISOString().slice(0, 10),
    status: "草稿",
  };
  update(projectId, (s) => ({ ...s, changes: [rec, ...s.changes] }));
  return rec;
}

export function removeChangeRecord(projectId: string, id: string) {
  update(projectId, (s) => ({ ...s, changes: s.changes.filter((c) => c.id !== id) }));
}

export function useConstruction(projectId: string) {
  const [state, setState] = useState<ConstructionState>(() =>
    typeof window === "undefined" ? { checklist: [], changes: [] } : getConstruction(projectId)
  );

  const refresh = useCallback(() => {
    setState(getConstruction(projectId));
  }, [projectId]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(CONSTRUCTION_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CONSTRUCTION_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  return {
    checklist: state.checklist,
    changes: state.changes,
    toggle: (id: string) => toggleChecklistItem(projectId, id),
    addChange: (input: { title: string; note: string; amountDelta: number }) =>
      addChangeRecord(projectId, input),
    removeChange: (id: string) => removeChangeRecord(projectId, id),
  };
}
