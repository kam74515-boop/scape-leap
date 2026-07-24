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

export const STICKY_COLORS = ["#FEF3C7", "#DBEAFE", "#FCE7F3", "#D1FAE5", "#EDE9FE", "#FFEDD5"] as const;

export const SHAPE_FILLS = ["#E0E7FF", "#FCE7F3", "#D1FAE5", "#FEF3C7", "#F3F4F6"] as const;

export const IMAGEGEN_MODELS = [
  { id: "formscape-style", label: "构境风格" },
  { id: "structure-safe", label: "保结构" },
  { id: "fast-draft", label: "快速草稿" },
] as const;

/** 兼容旧常量：从 registry 再导出 */
export { CANVAS_SKILLS } from "./skills/registry";
