/**
 * 画布技能库 — 对齐 lovspark-skill-library-cases 全部 14 个技能
 *
 * 展开参数轨只包含：
 *  - 上传槽：空间图 / 参考图 / 材质图（按技能配置）
 *  - 画面比例滑块
 *  - 生成数量
 *  - 生成图像到画布
 * 不做自由提示词编写、不做动态 tag 字段
 *
 * 生成结果：全部 mock，资源见 formscape-skill-mocks（构境可移植样例包）
 */

import { getMockSkillCovers } from "./mock-skill-assets";

/** 对齐 Lovspark toolsRegistry CATEGORIES */
export type SkillCategory = "image" | "video" | "spaces" | "3d" | "design" | "product";

/** 上传槽类型 — 对应 Lovspark upload_view / secondary / material slots */
export type SkillUploadKind = "space" | "reference" | "material";

export type SkillUploadSlot = {
  key: string;
  /** 展示名：空间图 / 参考图 / 材质图 … */
  label: string;
  kind: SkillUploadKind;
  required?: boolean;
  /** 多图槽（材质） */
  multiple?: boolean;
  max?: number;
};

export type CanvasSkillDef = {
  id: string;
  name: string;
  desc: string;
  category: SkillCategory;
  colors: string[];
  hoverColors?: string[];
  /** case 模拟封面（/formscape-skill-mocks） */
  coverSrc?: string;
  coverHoverSrc?: string;
  model: string;
  /** 上传槽配置（按技能不同） */
  uploads: SkillUploadSlot[];
  /** 比例滑块可选值 */
  aspectRatios: string[];
  defaultAspect: string;
  defaultCount: number;
  popular?: boolean;
  isNew?: boolean;
  credits?: number;
  /** Demo 生成用内部模板（用户不可见） */
  promptTemplate: string;
};

export const SKILL_CATEGORIES: { key: SkillCategory | "all" | "fav"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "fav", label: "收藏" },
  { key: "image", label: "出图" },
  { key: "spaces", label: "空间" },
  { key: "3d", label: "3D" },
  { key: "design", label: "设计" },
  { key: "product", label: "产品" },
];

export const SKILL_CAT_LABEL: Record<SkillCategory, string> = {
  image: "出图",
  video: "视频",
  spaces: "空间",
  "3d": "3D",
  design: "设计",
  product: "产品",
};

/** 常用比例（SizeView 滑块，从竖到横） */
export const DEFAULT_ASPECT_RATIOS = ["9:16", "2:3", "3:4", "1:1", "4:3", "3:2", "16:9", "21:9"];

export function skillMatchesCategory(skill: CanvasSkillDef, cat: SkillCategory | "all" | "fav"): boolean {
  if (cat === "all" || cat === "fav") return true;
  if (cat === "image") {
    return skill.category === "image" || skill.category === "design" || skill.category === "product";
  }
  return skill.category === cat;
}

const FAV_KEY = "formscape.canvas.skill.fav.v1";

export function loadFavoriteSkillIds(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveFavoriteSkillIds(ids: string[]) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(ids.slice(0, 64)));
  } catch {
    /* ignore */
  }
}

export function toggleFavoriteSkillId(id: string): string[] {
  const cur = loadFavoriteSkillIds();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
  saveFavoriteSkillIds(next);
  return next;
}

const SPACE: SkillUploadSlot = { key: "space", label: "空间图", kind: "space", required: true };
const REF: SkillUploadSlot = { key: "reference", label: "参考图", kind: "reference" };
const REF_REQ: SkillUploadSlot = { key: "reference", label: "参考图", kind: "reference", required: true };
const MATERIAL: SkillUploadSlot = {
  key: "material",
  label: "材质图",
  kind: "material",
  multiple: true,
  max: 6,
  required: true,
};
const WHITE_MODEL: SkillUploadSlot = {
  key: "space",
  label: "白模图",
  kind: "space",
  required: true,
};

function skill(
  partial: Omit<CanvasSkillDef, "aspectRatios" | "defaultAspect" | "defaultCount" | "promptTemplate"> &
    Partial<Pick<CanvasSkillDef, "aspectRatios" | "defaultAspect" | "defaultCount" | "promptTemplate">>
): CanvasSkillDef {
  const covers = getMockSkillCovers(partial.id);
  return {
    aspectRatios: DEFAULT_ASPECT_RATIOS,
    defaultAspect: "1:1",
    defaultCount: 1,
    promptTemplate: partial.name,
    coverSrc: covers.cover,
    coverHoverSrc: covers.hover,
    ...partial,
  };
}

/**
 * 全部 14 技能 — id 与 lovspark-skill-library-cases 目录名一一对应
 */
export const CANVAS_SKILLS: CanvasSkillDef[] = [
  skill({
    id: "unfurnished-space-generation",
    name: "空房设计",
    desc: "毛坯 / 空房一键铺风格出图",
    category: "spaces",
    colors: ["#F5F0E8", "#D4C4B0", "#8B7355"],
    model: "formscape-style",
    popular: true,
    isNew: true,
    credits: 10,
    uploads: [SPACE, REF],
    defaultAspect: "16:9",
    promptTemplate: "空房设计",
  }),
  skill({
    id: "white-model-rendering",
    name: "白模渲染",
    desc: "白模上色与风格预演（无材质槽）",
    category: "3d",
    colors: ["#F8FAFC", "#CBD5E1", "#64748B"],
    model: "structure-safe",
    popular: true,
    credits: 12,
    uploads: [WHITE_MODEL, REF],
    promptTemplate: "白模渲染",
  }),
  skill({
    id: "architectural-multi-angle",
    name: "建筑多角度",
    desc: "同一方案生成多视角画面",
    category: "spaces",
    colors: ["#E8EEF5", "#A8C0D8", "#5A7A9A"],
    model: "formscape-style",
    popular: true,
    credits: 14,
    uploads: [SPACE],
    defaultCount: 2,
    promptTemplate: "建筑多角度",
  }),
  skill({
    id: "space-to-axonometric",
    name: "空间转轴测",
    desc: "透视图转轴测制图感",
    category: "spaces",
    colors: ["#ECFDF5", "#6EE7B7", "#047857"],
    model: "structure-safe",
    credits: 12,
    uploads: [SPACE],
    defaultAspect: "1:1",
    promptTemplate: "空间转轴测",
  }),
  skill({
    id: "space-atmosphere-transformation",
    name: "空间氛围转换",
    desc: "保留结构，切换光影与氛围",
    category: "spaces",
    colors: ["#EDE9FE", "#C4B5FD", "#7C3AED"],
    model: "formscape-style",
    popular: true,
    credits: 12,
    uploads: [SPACE, REF],
    promptTemplate: "空间氛围转换",
  }),
  skill({
    id: "seasonal-changes",
    name: "四季变化",
    desc: "同一空间春夏秋冬四时效果",
    category: "spaces",
    colors: ["#FEF3C7", "#FBBF24", "#B45309"],
    model: "formscape-style",
    isNew: true,
    credits: 16,
    uploads: [SPACE],
    defaultCount: 4,
    defaultAspect: "16:9",
    promptTemplate: "四季变化",
  }),
  skill({
    id: "old-house-renovation",
    name: "老房改造",
    desc: "旧改前后对比与翻新效果",
    category: "spaces",
    colors: ["#FEE2E2", "#F87171", "#B91C1C"],
    model: "structure-safe",
    popular: true,
    credits: 14,
    uploads: [SPACE, REF],
    promptTemplate: "老房改造",
  }),
  skill({
    id: "multi-shot-storyboard",
    name: "分镜场景",
    desc: "空间叙事分镜 · 多镜头排布",
    category: "image",
    colors: ["#EDE9FE", "#C4B5FD", "#8B5CF6"],
    model: "fast-draft",
    credits: 12,
    uploads: [SPACE, REF],
    defaultCount: 4,
    promptTemplate: "分镜场景",
  }),
  skill({
    id: "furniture-sketches",
    name: "家具手绘",
    desc: "家具 / 单品线稿与手绘风格",
    category: "product",
    colors: ["#F3F4F6", "#D1D5DB", "#6B7280"],
    model: "fast-draft",
    credits: 6,
    uploads: [REF_REQ],
    promptTemplate: "家具手绘",
  }),
  skill({
    id: "color-mood-analysis",
    name: "情绪色彩",
    desc: "从参考图提取情绪与色彩分析",
    category: "design",
    colors: ["#FCE7F3", "#F9A8D4", "#BE185D"],
    model: "fast-draft",
    credits: 4,
    uploads: [REF_REQ],
    promptTemplate: "情绪色彩",
  }),
  skill({
    id: "material-extraction-analysis",
    name: "材质提取分析",
    desc: "从空间/产品图提取材质与色板",
    category: "design",
    colors: ["#F5F0E8", "#D4C4B0", "#A89070"],
    model: "fast-draft",
    credits: 6,
    uploads: [REF_REQ],
    promptTemplate: "材质提取分析",
  }),
  skill({
    id: "material-replacement",
    name: "材质替换",
    desc: "点选区域替换真实材质观感",
    category: "product",
    colors: ["#E8E4DC", "#C9B8A0", "#5C5346"],
    model: "structure-safe",
    popular: true,
    credits: 12,
    uploads: [SPACE, MATERIAL],
    promptTemplate: "材质替换",
  }),
  skill({
    id: "product-inspiration-expansion",
    name: "产品灵感裂变",
    desc: "单品延展同风格场景与变体",
    category: "product",
    colors: ["#F0EDE6", "#B8A890", "#6A6050"],
    model: "formscape-style",
    popular: true,
    isNew: true,
    credits: 12,
    uploads: [REF_REQ],
    defaultCount: 4,
    promptTemplate: "产品灵感裂变",
  }),
  skill({
    id: "model-generation",
    name: "模型生成",
    desc: "空间 / 产品 3D 体感预览图",
    category: "3d",
    colors: ["#334155", "#94A3B8", "#E2E8F0"],
    model: "structure-safe",
    isNew: true,
    credits: 14,
    uploads: [SPACE, REF],
    promptTemplate: "模型生成",
  }),
];

for (const s of CANVAS_SKILLS) {
  if (!s.hoverColors) s.hoverColors = [...s.colors].reverse();
  if (!s.coverSrc || !s.coverHoverSrc) {
    const covers = getMockSkillCovers(s.id);
    if (!s.coverSrc) s.coverSrc = covers.cover;
    if (!s.coverHoverSrc) s.coverHoverSrc = covers.hover;
  }
}

export const SKILLS_BY_ID = Object.fromEntries(CANVAS_SKILLS.map((s) => [s.id, s]));

/** Demo：根据技能 + 比例生成内部 prompt（不展示给用户） */
export function buildPromptFromSkill(
  skillDef: CanvasSkillDef,
  values: Record<string, string | number>
): string {
  const aspect = String(values.aspect ?? skillDef.defaultAspect);
  const count = values.count ?? skillDef.defaultCount;
  return `${skillDef.promptTemplate} · ${aspect} · ×${count}`;
}

/** @deprecated 兼容旧字段 API */
export function defaultFieldValues(skillDef: CanvasSkillDef): Record<string, string | number> {
  return {
    aspect: skillDef.defaultAspect,
    count: skillDef.defaultCount,
  };
}
