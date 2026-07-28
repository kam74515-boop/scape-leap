/**
 * 风格阶段 · 风格方向 Store（Demo · SQLite 持久化）
 * 3-5 组方向卡（名称/描述/色板/意向图）可增删改；选定一组作为本阶段结论
 * 「从项目图板导入」只读消费 style-boards-store 的 pin
 * 真源 = 服务端 SQLite（/api/fs/style_stage|render_stage）
 */
import { useCallback, useEffect, useState } from "react";
import { ensureFsHydrated, isFsHydrated, putFsDoc, readFsCache, registerFsEntity, replaceFsDocs } from "./fs-data-client";

export type StyleDirection = {
  id: string;
  name: string;
  desc: string;
  /** 色板（3 个左右 hex） */
  colors: string[];
  /** 意向图（mock 池 / 图板 pin） */
  image?: string;
  /** 来源标注：手动 / 项目图板 / 种子 */
  sourceLabel: string;
  createdAt: string;
};

type ProjectStyleState = {
  directions: StyleDirection[];
  selectedId: string | null;
};

export const STYLE_STAGE_CHANGE_EVENT = "fs-style-stage-change";

registerFsEntity("style_stage", STYLE_STAGE_CHANGE_EVENT);
ensureFsHydrated(["style_stage", "render_stage"]);

function uid() {
  return `dir-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function emitChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STYLE_STAGE_CHANGE_EVENT));
}

function seedState(): ProjectStyleState {
  const now = new Date().toISOString();
  return {
    selectedId: null,
    directions: [
      {
        id: uid(),
        name: "奶油石材",
        desc: "暖白基底 + 石材肌理，客厅通透耐看",
        colors: ["#F5F0E8", "#D4C4B0", "#8B7355"],
        image: "/formscape-skill-mocks/unfurnished-space-generation/case-01/out0.jpg",
        sourceLabel: "Demo 种子",
        createdAt: now,
      },
      {
        id: uid(),
        name: "轻法拱廊",
        desc: "拱形门洞与线条，法式但不甜腻",
        colors: ["#E8E4DC", "#C9B8A0", "#5C5346"],
        image: "/formscape-skill-mocks/space-atmosphere-transformation/case-01/out0.jpg",
        sourceLabel: "Demo 种子",
        createdAt: now,
      },
      {
        id: uid(),
        name: "橡木亚麻",
        desc: "自然材质为主的软装组合，低饱和",
        colors: ["#EDE6D9", "#C4A574", "#6B5B4F"],
        image: "/formscape-skill-mocks/material-extraction-analysis/case-01/out0.jpg",
        sourceLabel: "Demo 种子",
        createdAt: now,
      },
    ],
  };
}

type StyleDoc = ProjectStyleState & { id: string };

function loadAll(): Record<string, ProjectStyleState> {
  const map: Record<string, ProjectStyleState> = {};
  for (const d of readFsCache<StyleDoc>("style_stage")) {
    const { id, ...state } = d;
    map[id] = state;
  }
  return map;
}

function saveAll(map: Record<string, ProjectStyleState>, notify = true) {
  void notify; // 事件由 fs-data-client 统一发射
  replaceFsDocs("style_stage", Object.entries(map).map(([id, state]) => ({ id, ...state })));
}

export function getStyleStage(projectId: string): ProjectStyleState {
  const all = loadAll();
  if (!all[projectId]) {
    all[projectId] = seedState();
    // seed-on-miss 守卫：未 hydrate 前只在内存给种子，不写服务端
    if (isFsHydrated("style_stage")) saveAll(all, false);
  }
  return all[projectId];
}

function update(projectId: string, fn: (s: ProjectStyleState) => ProjectStyleState) {
  const all = loadAll();
  const cur = all[projectId] ?? seedState();
  all[projectId] = fn(cur);
  saveAll(all);
  return all[projectId];
}

export type StyleDirectionInput = {
  name: string;
  desc: string;
  colors: string[];
  image?: string;
  sourceLabel?: string;
};

export function addStyleDirection(projectId: string, input: StyleDirectionInput): StyleDirection {
  const dir: StyleDirection = {
    id: uid(),
    name: input.name.trim() || "未命名方向",
    desc: input.desc.trim(),
    colors: input.colors.filter(Boolean).slice(0, 4),
    image: input.image,
    sourceLabel: input.sourceLabel ?? "手动创建",
    createdAt: new Date().toISOString(),
  };
  update(projectId, (s) => ({ ...s, directions: [dir, ...s.directions] }));
  return dir;
}

export function updateStyleDirection(
  projectId: string,
  id: string,
  patch: Partial<StyleDirectionInput>
) {
  update(projectId, (s) => ({
    ...s,
    directions: s.directions.map((d) =>
      d.id === id
        ? {
            ...d,
            ...patch,
            name: (patch.name ?? d.name).trim() || d.name,
            colors: patch.colors ? patch.colors.filter(Boolean).slice(0, 4) : d.colors,
          }
        : d
    ),
  }));
}

export function removeStyleDirection(projectId: string, id: string) {
  update(projectId, (s) => ({
    ...s,
    directions: s.directions.filter((d) => d.id !== id),
    selectedId: s.selectedId === id ? null : s.selectedId,
  }));
}

/** 选定 / 取消选定风格方向（人做决策，AI 不自动选） */
export function selectStyleDirection(projectId: string, id: string | null) {
  update(projectId, (s) => ({ ...s, selectedId: id }));
}

export function useStyleStage(projectId: string) {
  const [state, setState] = useState<ProjectStyleState>(() =>
    typeof window === "undefined" ? { directions: [], selectedId: null } : getStyleStage(projectId)
  );

  const refresh = useCallback(() => {
    setState(getStyleStage(projectId));
  }, [projectId]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(STYLE_STAGE_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(STYLE_STAGE_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  return {
    directions: state.directions,
    selectedId: state.selectedId,
    add: (input: StyleDirectionInput) => addStyleDirection(projectId, input),
    updateDir: (id: string, patch: Partial<StyleDirectionInput>) =>
      updateStyleDirection(projectId, id, patch),
    remove: (id: string) => removeStyleDirection(projectId, id),
    select: (id: string | null) => selectStyleDirection(projectId, id),
  };
}

/* ============ 渲染阶段 · 采用成果（同文件避免 store 泛滥） ============ */

export type AdoptedRender = {
  id: string;
  src: string;
  skillId: string;
  skillName: string;
  /** 结构强度 0-100 */
  strength: number;
  adoptedAt: string;
};

export const RENDER_STAGE_CHANGE_EVENT = "fs-render-stage-change";

registerFsEntity("render_stage", RENDER_STAGE_CHANGE_EVENT);

type RenderDoc = AdoptedRender & { projectId: string };

function loadRenderAll(): Record<string, AdoptedRender[]> {
  const map: Record<string, AdoptedRender[]> = {};
  for (const r of readFsCache<RenderDoc>("render_stage")) {
    const { projectId, ...rest } = r;
    (map[projectId] ??= []).push(rest as AdoptedRender);
  }
  return map;
}

function saveRenderAll(map: Record<string, AdoptedRender[]>) {
  replaceFsDocs(
    "render_stage",
    Object.entries(map).flatMap(([projectId, items]) => items.map((r) => ({ ...r, projectId })))
  );
}

export function listAdoptedRenders(projectId: string): AdoptedRender[] {
  return loadRenderAll()[projectId] ?? [];
}

export function adoptRenders(
  projectId: string,
  items: Omit<AdoptedRender, "id" | "adoptedAt">[]
): AdoptedRender[] {
  const all = loadRenderAll();
  const cur = all[projectId] ?? [];
  const now = new Date().toISOString();
  const added = items
    // 同图不重复采用
    .filter((i) => !cur.some((c) => c.src === i.src))
    .map((i) => ({
      ...i,
      id: `rd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      adoptedAt: now,
    }));
  all[projectId] = [...added, ...cur];
  saveRenderAll(all);
  return all[projectId];
}

export function removeAdoptedRender(projectId: string, id: string) {
  const all = loadRenderAll();
  all[projectId] = (all[projectId] ?? []).filter((r) => r.id !== id);
  saveRenderAll(all);
}

export function useAdoptedRenders(projectId: string) {
  const [list, setList] = useState<AdoptedRender[]>(() =>
    typeof window === "undefined" ? [] : listAdoptedRenders(projectId)
  );
  useEffect(() => {
    const refresh = () => setList(listAdoptedRenders(projectId));
    refresh();
    window.addEventListener(RENDER_STAGE_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(RENDER_STAGE_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [projectId]);
  return {
    adopted: list,
    adopt: (items: Omit<AdoptedRender, "id" | "adoptedAt">[]) => adoptRenders(projectId, items),
    remove: (id: string) => removeAdoptedRender(projectId, id),
  };
}
