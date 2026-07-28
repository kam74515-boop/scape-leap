import type { CanvasSettings } from "./types";

export const CANVAS_STORAGE_KEY = "formscape.canvas.doc.v2";
export const CANVAS_SETTINGS_KEY = "formscape.canvas.settings.v2";

export const DEFAULT_SETTINGS: CanvasSettings = {
  showToolNames: true,
  bgPattern: "dots",
  panelsExclusive: true,
  snapToGrid: false,
  showMinimap: true,
};

/** 便签 pastel 色板：统一提亮一档（50 阶），与 brand 和谐（规范 v3 §1） */
export const STICKY_COLORS = ["#FFFBEB", "#EFF6FF", "#FDF2F8", "#ECFDF5", "#F5F3FF", "#FFF7ED"] as const;

/** 形状 pastel 填充：同提亮一档（首色为 brand 同族 indigo-50） */
export const SHAPE_FILLS = ["#EEF2FF", "#FDF2F8", "#ECFDF5", "#FFFBEB", "#F9FAFB"] as const;

export const IMAGEGEN_MODELS = [
  { id: "formscape-style", label: "构境风格" },
  { id: "structure-safe", label: "保结构" },
  { id: "fast-draft", label: "快速草稿" },
] as const;

/** 兼容旧常量：从 registry 再导出 */
export { CANVAS_SKILLS } from "./skills/registry";
