/** 画布树 Demo：项目 → 子画布（Codex 式目录） */
import { ensureFsHydrated, readFsCache, registerFsEntity, replaceFsDocs } from "./fs-data-client";
import { listProjects } from "./projects-store";
import type { PmProject } from "./pm-mock";

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
  stageLabel: string;
  canvases: CanvasBoard[];
};

export const PROJECT_CANVAS_TREE: ProjectCanvasTree[] = [
  {
    projectId: "proj-demo-1",
    projectName: "滨江壹号 · 新婚两居",
    stageLabel: "风格设计",
    canvases: [
      { id: "cv-bj-living", name: "客厅方案对比", updatedAt: "昨天", nodes: 0 },
      { id: "cv-bj-render", name: "效果图推演", updatedAt: "3 天前", nodes: 0 },
    ],
  },
  {
    projectId: "proj-demo-2",
    projectName: "徐汇老宅改造",
    stageLabel: "需求分析",
    canvases: [
      { id: "cv-xh-survey", name: "量房与现状", updatedAt: "昨天", nodes: 0 },
      { id: "cv-xh-structure", name: "结构节点示意", updatedAt: "上周", nodes: 0 },
    ],
  },
  {
    projectId: "proj-demo-3",
    projectName: "园区湖景平层",
    stageLabel: "线索",
    canvases: [{ id: "cv-yq-pitch", name: "方案意向初稿", updatedAt: "3 天前", nodes: 0 }],
  },
];

/** 用户「新建画布」落点（与 L2 侧栏共用） */
/** 自建子画布变更事件（SQLite hydrate 完成后 L2 树据此刷新） */
export const CANVAS_TREE_CHANGE_EVENT = "fs-canvas-tree-change";

registerFsEntity("canvas_boards", CANVAS_TREE_CHANGE_EVENT);
ensureFsHydrated(["canvas_boards"]);

type CanvasBoardDoc = CanvasBoard & { projectId: string };

/** 自建子画布：真源 = 服务端 SQLite（/api/fs/canvas_boards） */
export function loadExtraCanvases(): Record<string, CanvasBoard[]> {
  if (typeof window === "undefined") return {};
  const map: Record<string, CanvasBoard[]> = {};
  for (const b of readFsCache<CanvasBoardDoc>("canvas_boards")) {
    const { projectId, ...board } = b;
    (map[projectId] ??= []).push(board as CanvasBoard);
  }
  return map;
}

export function saveExtraCanvases(map: Record<string, CanvasBoard[]>) {
  if (typeof window === "undefined") return;
  replaceFsDocs(
    "canvas_boards",
    Object.entries(map).flatMap(([projectId, boards]) => boards.map((b) => ({ ...b, projectId })))
  );
}

export function canvasDefaultBoardId(projectId: string) {
  return `cv-${projectId}-main`;
}

function defaultCanvas(projectId: string): CanvasBoard {
  return {
    id: canvasDefaultBoardId(projectId),
    name: "项目主画布",
    updatedAt: "刚刚",
    nodes: 0,
  };
}

export function mergeCanvasTree(
  extra?: Record<string, CanvasBoard[]>,
  catalog: PmProject[] = listProjects()
): ProjectCanvasTree[] {
  const map = extra ?? (typeof window !== "undefined" ? loadExtraCanvases() : {});
  const templates = new Map(PROJECT_CANVAS_TREE.map((project) => [project.projectId, project]));
  const projects = catalog.length
    ? catalog
    : PROJECT_CANVAS_TREE.map((project) => ({
        id: project.projectId,
        name: project.projectName,
        stageLabel: project.stageLabel,
      }));

  return projects.map((project) => {
    const template = templates.get(project.id);
    const canvases = [...(template?.canvases ?? []), ...(map[project.id] ?? [])];
    return {
      projectId: project.id,
      projectName: project.name,
      stageLabel: project.stageLabel,
      canvases: canvases.length ? canvases : [defaultCanvas(project.id)],
    };
  });
}

export function canvasHref(workspaceSlug: string, projectId: string, canvasId: string) {
  return `/${workspaceSlug}/canvas?project=${encodeURIComponent(projectId)}&board=${encodeURIComponent(canvasId)}`;
}

/**
 * 解析当前子画布元信息（含本地新建）
 * 找不到 board 时：仍返回项目 + 占位新板，保证点击可进入空白画布
 */
export function findCanvasMeta(projectId?: string | null, boardId?: string | null) {
  if (!projectId) return null;
  const tree = mergeCanvasTree();
  const proj = tree.find((p) => p.projectId === projectId);
  if (!proj) {
    // 未知项目 id：仍允许打开独立板，并给无 board 链接一个稳定主画布
    const fallbackBoardId = boardId ?? canvasDefaultBoardId(projectId);
    return {
      project: {
        projectId,
        projectName: projectId,
        stageLabel: "画布",
        canvases: [] as CanvasBoard[],
      },
      board: {
        id: fallbackBoardId,
        name: boardId ? "未命名画布" : "项目主画布",
        updatedAt: "刚刚",
        nodes: 0,
      } satisfies CanvasBoard,
    };
  }
  const board =
    (boardId ? proj.canvases.find((c) => c.id === boardId) : undefined) ??
    (boardId
      ? ({
          id: boardId,
          name: "未命名画布",
          updatedAt: "刚刚",
          nodes: 0,
        } satisfies CanvasBoard)
      : proj.canvases[0]);
  if (!board) return { project: proj, board: null as CanvasBoard | null };
  return { project: proj, board };
}
