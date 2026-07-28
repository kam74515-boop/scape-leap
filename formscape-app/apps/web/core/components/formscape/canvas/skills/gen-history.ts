/**
 * 生成结果历史（SQLite via fs-data-client）
 * 一键落图 / 样例落点后写入，图库「历史」可读回
 * 真源 = 服务端 SQLite（/api/fs/gen_history）
 */
import { ensureFsHydrated, readFsCache, registerFsEntity, replaceFsDocs } from "../../fs-data-client";

export type GenHistoryItem = {
  id: string;
  title: string;
  src?: string;
  colors: string[];
  skillId?: string;
  source: "generate" | "sample" | "agent" | "upload";
  createdAt: string;
};

const MAX = 48;

/** 历史变更事件：生成落图后图库「历史」标签即时刷新 */
export const GEN_HISTORY_CHANGE_EVENT = "fs-gen-history-change";

registerFsEntity("gen_history", GEN_HISTORY_CHANGE_EVENT);
ensureFsHydrated(["gen_history"]);

export function loadGenHistory(): GenHistoryItem[] {
  return readFsCache<GenHistoryItem>("gen_history");
}

export function saveGenHistory(items: GenHistoryItem[]) {
  replaceFsDocs("gen_history", items.slice(0, MAX));
}

export function pushGenHistory(item: Omit<GenHistoryItem, "id" | "createdAt"> & { id?: string }) {
  const next: GenHistoryItem = {
    id: item.id || `gh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: item.title,
    src: item.src,
    colors: item.colors?.length ? item.colors : ["#E8E4DC", "#C9B8A0", "#5C5346"],
    skillId: item.skillId,
    source: item.source,
    createdAt: new Date().toISOString(),
  };
  const prev = loadGenHistory().filter((x) => x.src !== next.src || x.title !== next.title);
  saveGenHistory([next, ...prev]);
  return next;
}

export function pushGenHistoryMany(
  items: Array<Omit<GenHistoryItem, "id" | "createdAt"> & { id?: string }>
) {
  if (!items.length) return;
  let list = loadGenHistory();
  for (const item of items) {
    const next: GenHistoryItem = {
      id: item.id || `gh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      title: item.title,
      src: item.src,
      colors: item.colors?.length ? item.colors : ["#E8E4DC", "#C9B8A0", "#5C5346"],
      skillId: item.skillId,
      source: item.source,
      createdAt: new Date().toISOString(),
    };
    list = [next, ...list.filter((x) => x.src !== next.src || x.title !== next.title)];
  }
  saveGenHistory(list);
}

export function clearGenHistory() {
  replaceFsDocs("gen_history", []);
}

/** 图库拖拽 MIME */
export const CANVAS_DND_MIME = "application/x-formscape-canvas-image";

export type CanvasDndPayload = {
  title: string;
  tags: string[];
  colors: string[];
  source: "library" | "upload" | "agent" | "generate";
  skillId?: string;
  src?: string;
};

export function encodeDndPayload(p: CanvasDndPayload): string {
  return JSON.stringify(p);
}

export function decodeDndPayload(raw: string | null | undefined): CanvasDndPayload | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as CanvasDndPayload;
    if (!o || typeof o.title !== "string") return null;
    return o;
  } catch {
    return null;
  }
}
