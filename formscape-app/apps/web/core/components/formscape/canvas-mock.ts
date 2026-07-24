/** 画布树 Demo：项目 → 子画布（Codex 式目录） */

export type CanvasBoard = {
  id: string;
  name: string;
  updatedAt: string;
  /** 节点数 Demo */
  nodes: number;
};

export type ProjectCanvasTree = {
  projectId: string;
  projectName: string;
  emoji: string;
  stageLabel: string;
  canvases: CanvasBoard[];
};

export const PROJECT_CANVAS_TREE: ProjectCanvasTree[] = [
  {
    projectId: "proj-demo-1",
    projectName: "滨江壹号 · 新婚两居",
    emoji: "🏠",
    stageLabel: "风格设计",
    canvases: [
      { id: "cv-bj-style", name: "风格 moodboard", updatedAt: "今天", nodes: 12 },
      { id: "cv-bj-living", name: "客厅方案对比", updatedAt: "昨天", nodes: 8 },
      { id: "cv-bj-render", name: "效果图推演", updatedAt: "3 天前", nodes: 5 },
    ],
  },
  {
    projectId: "proj-demo-2",
    projectName: "徐汇老宅改造",
    emoji: "🏛️",
    stageLabel: "需求分析",
    canvases: [
      { id: "cv-xh-survey", name: "量房与现状", updatedAt: "昨天", nodes: 6 },
      { id: "cv-xh-structure", name: "结构节点示意", updatedAt: "上周", nodes: 4 },
    ],
  },
  {
    projectId: "proj-demo-3",
    projectName: "园区湖景平层",
    emoji: "🌊",
    stageLabel: "线索",
    canvases: [
      { id: "cv-yq-pitch", name: "方案意向初稿", updatedAt: "3 天前", nodes: 3 },
    ],
  },
];

export function canvasHref(workspaceSlug: string, projectId: string, canvasId: string) {
  return `/${workspaceSlug}/canvas?project=${encodeURIComponent(projectId)}&board=${encodeURIComponent(canvasId)}`;
}

export function findCanvasMeta(projectId?: string | null, boardId?: string | null) {
  if (!projectId) return null;
  const proj = PROJECT_CANVAS_TREE.find((p) => p.projectId === projectId);
  if (!proj) return null;
  const board = boardId ? proj.canvases.find((c) => c.id === boardId) : proj.canvases[0];
  return { project: proj, board: board ?? proj.canvases[0] };
}
