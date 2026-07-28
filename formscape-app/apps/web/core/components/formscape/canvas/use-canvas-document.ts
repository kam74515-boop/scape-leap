import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node, Viewport } from "@xyflow/react";
import type { FormscapeProject } from "../types";
import { CANVAS_SETTINGS_KEY, DEFAULT_SETTINGS } from "./constants";
import type {
  CanvasNodeData,
  CanvasNodeKind,
  CanvasPersistedDoc,
  CanvasSettings,
} from "./types";
import {
  ensureFsHydrated,
  putFsDoc,
  readFsCache,
  registerFsEntity,
} from "../fs-data-client";

export type FsCanvasNode = Node<CanvasNodeData, CanvasNodeKind>;
export type FsCanvasEdge = Edge;

export const CANVAS_DOC_CHANGE_EVENT = "fs-canvas-doc-change";

registerFsEntity("canvas_docs", CANVAS_DOC_CHANGE_EVENT);
ensureFsHydrated(["canvas_docs"]);

/** 每子画布独立文档 id（SQLite entities 主键）：{projectId}::{boardId} */
export function canvasDocStorageKey(projectId: string, boardId: string) {
  return `${projectId}::${boardId}`;
}

/** 子画布默认空白，不种风格板 / moodboard */
function emptyBoardNodes(): FsCanvasNode[] {
  return [];
}

/** 读档：SQLite canvas_docs 实体（导出供回归测试驱动 shipped 路径） */
export function loadCanvasDoc(projectId: string, boardId: string): CanvasPersistedDoc | null {
  if (typeof window === "undefined") return null;
  const doc = readFsCache<CanvasPersistedDoc & { id: string }>("canvas_docs").find(
    (d) => d.id === canvasDocStorageKey(projectId, boardId)
  );
  if (!doc) return null;
  if (doc.version === 1 && doc.projectId === projectId) return doc;
  return null;
}

/**
 * 唯一写入路径（纯函数，shipped）：序列化节点/边/视口 → SQLite canvas_docs。
 * hook 的 persist 与本模块测试都走这里；乐观缓存 + PUT 落库（fs-data-client）。
 */
export function persistCanvasDoc(
  projectId: string,
  boardId: string,
  nextNodes: FsCanvasNode[],
  nextEdges: FsCanvasEdge[],
  nextViewport?: Viewport
): void {
  if (typeof window === "undefined") return;
  const id = canvasDocStorageKey(projectId, boardId);
  const doc: CanvasPersistedDoc & { id: string } = {
    id,
    version: 1,
    projectId,
    boardId,
    nodes: nextNodes.map((n) => ({
      id: n.id,
      type: (n.type ?? "image") as CanvasNodeKind,
      position: n.position,
      data: n.data,
      width: typeof n.style?.width === "number" ? n.style.width : undefined,
      height: typeof n.style?.height === "number" ? n.style.height : undefined,
      parentId: n.parentId,
    })),
    edges: nextEdges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    viewport: nextViewport,
    updatedAt: new Date().toISOString(),
  };
  putFsDoc("canvas_docs", doc);
}

function docToGraph(doc: CanvasPersistedDoc): { nodes: FsCanvasNode[]; edges: FsCanvasEdge[] } {
  const nodes: FsCanvasNode[] = doc.nodes.map((n) => {
    const isGen = n.type === "imagegen" || n.type === "videogen";
    const width = n.width ?? (isGen ? (n.type === "videogen" ? 280 : 260) : undefined);
    const height = isGen ? undefined : n.height;
    return {
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
      parentId: n.parentId,
      style: width || height ? { width, height } : undefined,
      zIndex: n.type === "frame" ? -1 : undefined,
    };
  });
  return { nodes, edges: doc.edges };
}

export function loadCanvasSettings(): CanvasSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw =
      localStorage.getItem(CANVAS_SETTINGS_KEY) || localStorage.getItem("formscape.canvas.settings.v1");
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveCanvasSettings(s: CanvasSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CANVAS_SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/**
 * @param boardId 子画布 id；每个 board 独立文档。无存档时一律空白（无风格板种子）。
 *
 * 持久化契约（收口后的单一写入路径）：
 * - hook 只负责「读档 seed + 提供 persist」；节点真源在 CanvasWorkspace 的
 *   useNodesState 里，由 workspace 的自动保存 effect 调 persist(活节点, [], 活视口)。
 * - hook 内不再自动落盘（旧实现用 hook 内从未更新的 stale seed 覆盖 board key，
 *   导致编辑后刷新丢节点），也不再写未分板全局 key。
 */
export function useCanvasDocument(project: FormscapeProject, boardId: string) {
  const docKey = `${project.id}::${boardId}`;

  const seed = useMemo(() => {
    const saved = loadCanvasDoc(project.id, boardId);
    if (saved) return { ...docToGraph(saved), viewport: saved.viewport };
    return { nodes: emptyBoardNodes(), edges: [] as FsCanvasEdge[], viewport: undefined };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey]);

  const [nodes, setNodes] = useState<FsCanvasNode[]>(seed.nodes);
  const [edges, setEdges] = useState<FsCanvasEdge[]>(seed.edges);
  const [viewport, setViewport] = useState<Viewport | undefined>(seed.viewport);
  const [settings, setSettingsState] = useState<CanvasSettings>(loadCanvasSettings);

  // 视口用 ref 兜底：persist 不闭包 viewport state，避免 stale
  const viewportRef = useRef<Viewport | undefined>(seed.viewport);
  const setViewportSafe = useCallback((vp: Viewport | undefined) => {
    viewportRef.current = vp;
    setViewport(vp);
  }, []);

  // project+board 变化时重载（组件应 key remount；此 effect 作双保险）
  useEffect(() => {
    const saved = loadCanvasDoc(project.id, boardId);
    if (saved) {
      const g = docToGraph(saved);
      setNodes(g.nodes);
      setEdges(g.edges);
      setViewportSafe(saved.viewport);
    } else {
      setNodes(emptyBoardNodes());
      setEdges([]);
      setViewportSafe(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey]);

  /** 唯一写入路径：board 级 key。调用方必须传「当前活节点」，视口可显式传或用最近一次。 */
  const persist = useCallback(
    (nextNodes: FsCanvasNode[], nextEdges: FsCanvasEdge[], nextViewport?: Viewport) => {
      if (typeof window === "undefined") return;
      if (nextViewport) viewportRef.current = nextViewport;
      persistCanvasDoc(project.id, boardId, nextNodes, nextEdges, nextViewport ?? viewportRef.current);
    },
    [project.id, boardId]
  );

  const setSettings = useCallback((patch: Partial<CanvasSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveCanvasSettings(next);
      return next;
    });
  }, []);

  /** 清空当前子画布存档（不再回种风格板）；workspace 需同步清空活节点 */
  const resetToMoodboard = useCallback(() => {
    const n = emptyBoardNodes();
    setNodes(n);
    setEdges([]);
    persist(n, []);
  }, [persist]);

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    viewport,
    setViewport: setViewportSafe,
    settings,
    setSettings,
    persist,
    resetToMoodboard,
    boardId,
  };
}

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
