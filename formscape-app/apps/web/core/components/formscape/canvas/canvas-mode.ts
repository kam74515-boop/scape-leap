/**
 * 画布模式
 * - normal：普通画布（图、便签、文字、形状、画板、评论 + 图片/视频生成器）
 * - node：节点模式（技能管线、连线编排等高级能力）
 *
 * 节点模式 UI 暂隐藏；生成器在普通模式下始终可用（A / ⌘E）。
 */
export type CanvasViewMode = "normal" | "node";

/** 为 true 时才显示模式切换 / 允许进入节点模式 */
export const NODE_MODE_AVAILABLE = false;

export const DEFAULT_VIEW_MODE: CanvasViewMode = "normal";

export function isNodeViewMode(mode: CanvasViewMode): boolean {
  return NODE_MODE_AVAILABLE && mode === "node";
}

/**
 * 仅节点模式展示的类型（管线/编排产物）。
 * 图片/视频生成器属于普通模式核心能力，不在此列。
 */
export const NODE_MODE_ONLY_TYPES = new Set<string>([]);
