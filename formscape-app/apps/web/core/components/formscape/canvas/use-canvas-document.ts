import { useCallback, useEffect, useMemo, useState } from "react";
import type { Edge, Node, Viewport } from "@xyflow/react";
import type { FormscapeProject } from "../types";
import { CANVAS_SETTINGS_KEY, CANVAS_STORAGE_KEY, DEFAULT_SETTINGS } from "./constants";
import type {
  CanvasNodeData,
  CanvasNodeKind,
  CanvasPersistedDoc,
  CanvasSettings,
  ImageNodeData,
} from "./types";

export type FsCanvasNode = Node<CanvasNodeData, CanvasNodeKind>;
export type FsCanvasEdge = Edge;

function moodboardToNodes(project: FormscapeProject): FsCanvasNode[] {
  const imageNodes: FsCanvasNode[] = project.moodboard.map((card, i) => ({
    id: `mood-${card.id}`,
    type: "image",
    position: { x: 80 + i * 240, y: 80 + (i % 2) * 40 },
    data: {
      kind: "image",
      title: card.title,
      tags: card.tags,
      colors: card.colors,
      source: "moodboard",
    } satisfies ImageNodeData,
    style: { width: 208, height: 168 },
  }));

  const sticky: FsCanvasNode = {
    id: "sticky-default",
    type: "sticky",
    position: { x: 80 + project.moodboard.length * 240, y: 120 },
    data: {
      kind: "sticky",
      text: "客户偏好：暖白主调、拱形门洞、少金属冷光。",
      color: "#FEF3C7",
    },
    style: { width: 180, height: 140 },
  };

  const frame: FsCanvasNode = {
    id: "frame-style",
    type: "frame",
    position: { x: 60, y: 40 },
    data: { kind: "frame", label: "风格意向", tint: "rgba(139,92,246,0.06)" },
    style: { width: 80 + project.moodboard.length * 240 + 40, height: 280 },
    zIndex: -1,
  };

  return [frame, ...imageNodes, sticky];
}

function loadDoc(projectId: string): CanvasPersistedDoc | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(CANVAS_STORAGE_KEY) || localStorage.getItem("formscape.canvas.doc.v1");
    if (!raw) return null;
    const doc = JSON.parse(raw) as CanvasPersistedDoc;
    if (doc.version !== 1 || doc.projectId !== projectId) return null;
    return doc;
  } catch {
    return null;
  }
}

function docToGraph(doc: CanvasPersistedDoc): { nodes: FsCanvasNode[]; edges: FsCanvasEdge[] } {
  const nodes: FsCanvasNode[] = doc.nodes.map((n) => {
    // 生成器节点勿恢复固定 height，否则表单被裁切点不到
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

export function useCanvasDocument(project: FormscapeProject) {
  const seed = useMemo(() => {
    const saved = loadDoc(project.id);
    if (saved) return docToGraph(saved);
    return { nodes: moodboardToNodes(project), edges: [] as FsCanvasEdge[] };
    // 只跟 project.id 绑定，避免父组件每次新 project 引用触发重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const [nodes, setNodes] = useState<FsCanvasNode[]>(seed.nodes);
  const [edges, setEdges] = useState<FsCanvasEdge[]>(seed.edges);
  const [viewport, setViewport] = useState<Viewport | undefined>(() => loadDoc(project.id)?.viewport);
  const [settings, setSettingsState] = useState<CanvasSettings>(loadCanvasSettings);

  // 仅 project.id 变化时重载（禁止 project 对象引用触发）
  useEffect(() => {
    const saved = loadDoc(project.id);
    if (saved) {
      const g = docToGraph(saved);
      setNodes(g.nodes);
      setEdges(g.edges);
      setViewport(saved.viewport);
    } else {
      setNodes(moodboardToNodes(project));
      setEdges([]);
      setViewport(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const persist = useCallback(
    (nextNodes: FsCanvasNode[], nextEdges: FsCanvasEdge[], nextViewport?: Viewport) => {
      if (typeof window === "undefined") return;
      const doc: CanvasPersistedDoc = {
        version: 1,
        projectId: project.id,
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
        viewport: nextViewport ?? viewport,
        updatedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(doc));
      } catch {
        /* ignore */
      }
    },
    [project.id, viewport]
  );

  // 防抖持久化
  useEffect(() => {
    const t = window.setTimeout(() => persist(nodes, edges, viewport), 400);
    return () => window.clearTimeout(t);
  }, [nodes, edges, viewport, persist]);

  const setSettings = useCallback((patch: Partial<CanvasSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveCanvasSettings(next);
      return next;
    });
  }, []);

  const resetToMoodboard = useCallback(() => {
    const n = moodboardToNodes(project);
    setNodes(n);
    setEdges([]);
    persist(n, [], viewport);
  }, [project, persist, viewport]);

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    viewport,
    setViewport,
    settings,
    setSettings,
    resetToMoodboard,
  };
}

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
