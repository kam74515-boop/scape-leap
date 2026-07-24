/**
 * 生成器模型目录 — 对齐 Lovspark imagegen/models 简化版（Demo）
 */

export type GenModel = {
  id: string;
  name: string;
  media: "image" | "video" | "both";
  desc: string;
  credits: number;
  tags?: ("new" | "premium" | "sale")[];
  maxRefs?: number;
  durations?: number[];
};

export const IMAGE_MODELS: GenModel[] = [
  {
    id: "formscape-style",
    name: "构境风格",
    media: "image",
    desc: "室内设计通用 · 暖调友好",
    credits: 4,
    tags: ["new"],
    maxRefs: 4,
  },
  {
    id: "structure-safe",
    name: "保结构",
    media: "image",
    desc: "ControlNet 风格 · 几何稳定",
    credits: 6,
    maxRefs: 3,
  },
  {
    id: "fast-draft",
    name: "快速草稿",
    media: "image",
    desc: "低成本概念草图",
    credits: 2,
    maxRefs: 2,
  },
  {
    id: "flux-pro",
    name: "Flux Pro",
    media: "image",
    desc: "高细节效果图",
    credits: 10,
    tags: ["premium"],
    maxRefs: 4,
  },
  {
    id: "render-hd",
    name: "高清渲染",
    media: "image",
    desc: "2K 级室内渲染观感",
    credits: 12,
    tags: ["premium", "sale"],
    maxRefs: 3,
  },
];

export const VIDEO_MODELS: GenModel[] = [
  {
    id: "formscape-motion",
    name: "构境运镜",
    media: "video",
    desc: "室内空间镜头推进 / 环绕",
    credits: 20,
    tags: ["new"],
    maxRefs: 2,
    durations: [4, 6, 8],
  },
  {
    id: "storyboard-clip",
    name: "分镜短片",
    media: "video",
    desc: "方案讲解短视频",
    credits: 24,
    maxRefs: 3,
    durations: [4, 6, 10],
  },
  {
    id: "walkthrough",
    name: "漫游预览",
    media: "video",
    desc: "空间漫游感",
    credits: 30,
    tags: ["premium"],
    maxRefs: 2,
    durations: [6, 8, 10],
  },
];

export const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1", w: 1, h: 1 },
  { id: "4:3", label: "4:3", w: 4, h: 3 },
  { id: "3:2", label: "3:2", w: 3, h: 2 },
  { id: "16:9", label: "16:9", w: 16, h: 9 },
  { id: "9:16", label: "9:16", w: 9, h: 16 },
  { id: "21:9", label: "21:9", w: 21, h: 9 },
] as const;

export const IMAGE_COUNTS = [1, 2, 4] as const;

export const IMAGE_QUALITIES = [
  { id: "draft" as const, label: "草稿", creditsMul: 0.5 },
  { id: "standard" as const, label: "标准", creditsMul: 1 },
  { id: "hd" as const, label: "高清", creditsMul: 1.8 },
];

export function estimateImageCredits(modelId: string, count: number, quality: "draft" | "standard" | "hd"): number {
  const base = modelById(modelId)?.credits ?? 4;
  const mul = IMAGE_QUALITIES.find((q) => q.id === quality)?.creditsMul ?? 1;
  return Math.max(1, Math.round(base * mul * Math.max(1, count)));
}

/** 按比例计算节点预览尺寸（最长边 base） */
export function sizeForAspect(aspect: string, base = 240): { width: number; height: number } {
  const parts = aspect.split(":").map(Number);
  const w = parts[0] || 1;
  const h = parts[1] || 1;
  if (w >= h) return { width: base, height: Math.max(120, Math.round((base * h) / w)) };
  return { width: Math.max(120, Math.round((base * w) / h)), height: base };
}

export const VIDEO_MODES = [
  { id: "text", label: "文本" },
  { id: "image", label: "图生视频" },
  { id: "frames", label: "首尾帧" },
  { id: "reference", label: "参考" },
] as const;

export type VideoModeId = (typeof VIDEO_MODES)[number]["id"];

export function modelById(id: string): GenModel | undefined {
  return IMAGE_MODELS.find((m) => m.id === id) || VIDEO_MODELS.find((m) => m.id === id);
}
