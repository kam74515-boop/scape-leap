/**
 * 意向画布域类型 — 对齐 Lovspark canvas 能力模型，适配构境 ERP
 */

export type { CanvasViewMode } from "./canvas-mode";

export type CanvasTool =
  | "select"
  | "pan"
  | "frame"
  | "shape"
  | "text"
  | "sticky"
  | "comment"
  | "imagegen"
  | "videogen";

export type CanvasNodeKind =
  | "image"
  | "sticky"
  | "text"
  | "frame"
  | "imagegen"
  | "videogen"
  | "comment"
  | "shape";

export type CanvasBgPattern = "dots" | "lines" | "cross" | "none";

/** 与 L2 库分区对齐（不含画布树 boards） */
export type LibrarySection = "images" | "ecology" | "skills";

export type ShapeKind = "rect" | "ellipse" | "line" | "arrow";

export type GenStatus = "idle" | "queued" | "running" | "done" | "error";

export type ImageNodeData = {
  kind: "image";
  title: string;
  tags: string[];
  colors: string[];
  src?: string;
  locked?: boolean;
  source?: "moodboard" | "library" | "upload" | "generate" | "agent" | "skill" | "video-frame";
  skillId?: string;
};

export type StickyNodeData = {
  kind: "sticky";
  text: string;
  color: string;
};

export type TextNodeData = {
  kind: "text";
  text: string;
  fontSize: number;
  bold?: boolean;
};

export type FrameNodeData = {
  kind: "frame";
  label: string;
  tint?: string;
};

/** 单张生成结果（Demo 用色板模拟；可接真实 url） */
export type ImageGenResult = {
  id: string;
  title: string;
  colors: string[];
  src?: string;
  seed?: number;
};

/** 图片生成器节点 */
export type ImageGenNodeData = {
  kind: "imagegen";
  prompt: string;
  /** 可选负向提示词 */
  negativePrompt?: string;
  status: GenStatus;
  /** 主预览（与 selectedResultIndex 同步） */
  resultColors?: string[];
  resultTitle?: string;
  model: string;
  skillId?: string;
  aspect: string;
  count: number;
  quality: "draft" | "standard" | "hd";
  /** 参考图（渐变色或 url） */
  refs: { id: string; title: string; colors: string[]; src?: string }[];
  progress?: number;
  error?: string;
  /** 多图结果 */
  results?: ImageGenResult[];
  /** 当前选中的结果下标 */
  selectedResultIndex?: number;
  /** 最近一次任务 token（用于取消） */
  jobId?: string;
  seed?: number;
  /** 技能一键落图：生成完成后自动 promote 为 image 节点 */
  autoPromoteOnDone?: boolean;
  /** 完成后是否移除生成器节点（默认 true 当 autoPromote） */
  removeAfterPromote?: boolean;
};

/** 视频生成器节点 */
export type VideoGenNodeData = {
  kind: "videogen";
  prompt: string;
  status: GenStatus;
  model: string;
  aspect: string;
  duration: number;
  videoMode: "text" | "image" | "frames" | "reference";
  withAudio: boolean;
  cameraMove?: string;
  refs: { id: string; title: string; colors: string[]; role?: "start" | "end" | "ref"; src?: string }[];
  progress?: number;
  error?: string;
  resultTitle?: string;
  resultColors?: string[];
};

export type CommentNodeData = {
  kind: "comment";
  text: string;
  author: string;
};

export type ShapeNodeData = {
  kind: "shape";
  shape: ShapeKind;
  fill: string;
  stroke: string;
  label?: string;
};

export type CanvasNodeData =
  | ImageNodeData
  | StickyNodeData
  | TextNodeData
  | FrameNodeData
  | ImageGenNodeData
  | VideoGenNodeData
  | CommentNodeData
  | ShapeNodeData;

/** @deprecated 使用 skills/registry CanvasSkillDef */
export type CanvasSkill = {
  id: string;
  name: string;
  desc: string;
  colors: string[];
};

export type CanvasSettings = {
  showToolNames: boolean;
  bgPattern: CanvasBgPattern;
  panelsExclusive: boolean;
  snapToGrid: boolean;
  showMinimap: boolean;
};

export type CanvasPersistedDoc = {
  version: 1;
  projectId: string;
  nodes: Array<{
    id: string;
    type: CanvasNodeKind;
    position: { x: number; y: number };
    data: CanvasNodeData;
    width?: number;
    height?: number;
    parentId?: string;
  }>;
  edges: Array<{ id: string; source: string; target: string }>;
  viewport?: { x: number; y: number; zoom: number };
  updatedAt: string;
};
