/**
 * 画布技能库 — 对齐 Lovspark CanvasSkillPanel / dynamic skill schema
 *
 * 展开参数轨只包含：
 *  - 上传槽：空间图 / 参考图 / 材质图（按技能配置）
 *  - 画面比例滑块
 *  - 生成数量
 *  - 生成图像到画布
 * 不做自由提示词编写、不做动态 tag 字段（与用户确认的 Lovspark 行为一致）
 */

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
  { key: "video", label: "视频" },
  { key: "spaces", label: "空间" },
  { key: "3d", label: "3D" },
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
  if (cat === "image") return skill.category === "image" || skill.category === "design" || skill.category === "product";
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
const MATERIAL: SkillUploadSlot = {
  key: "material",
  label: "材质图",
  kind: "material",
  multiple: true,
  max: 6,
};

function skill(
  partial: Omit<CanvasSkillDef, "aspectRatios" | "defaultAspect" | "defaultCount" | "promptTemplate"> &
    Partial<Pick<CanvasSkillDef, "aspectRatios" | "defaultAspect" | "defaultCount" | "promptTemplate">>
): CanvasSkillDef {
  return {
    aspectRatios: DEFAULT_ASPECT_RATIOS,
    defaultAspect: "1:1",
    defaultCount: 1,
    promptTemplate: partial.name,
    ...partial,
  };
}

/**
 * 技能列表 — 每技能声明上传槽，无用户提示词字段
 * （对齐 Lovspark：多数动态技能 showDynamicPrompt=false）
 */
export const CANVAS_SKILLS: CanvasSkillDef[] = [
  skill({
    id: "style-render-2",
    name: "风格渲染 2.0",
    desc: "高级 AI 风格迁移 · 保结构渲染",
    category: "image",
    colors: ["#EDE6D9", "#C4A574", "#6B5B4F"],
    hoverColors: ["#F5F0E8", "#D4C4B0", "#8B7355"],
    model: "structure-safe",
    popular: true,
    isNew: true,
    credits: 12,
    uploads: [SPACE, REF],
    promptTemplate: "风格渲染 2.0",
  }),
  skill({
    id: "style-render-1",
    name: "风格渲染 1.0",
    desc: "经典风格迁移，快速出图",
    category: "image",
    colors: ["#F5F0E8", "#D4C4B0", "#8B7355"],
    model: "formscape-style",
    credits: 8,
    uploads: [SPACE, REF],
    promptTemplate: "风格渲染 1.0",
  }),
  skill({
    id: "blank-room",
    name: "空房 / 毛坯设计",
    desc: "白模或毛坯空间一键铺风格",
    category: "spaces",
    colors: ["#F5F0E8", "#D4C4B0", "#8B7355"],
    model: "formscape-style",
    popular: true,
    credits: 10,
    uploads: [SPACE, REF],
    defaultAspect: "16:9",
    promptTemplate: "空房设计",
  }),
  skill({
    id: "multi-angle",
    name: "多角度",
    desc: "同一方案生成多视角画面",
    category: "spaces",
    colors: ["#E8EEF5", "#A8C0D8", "#5A7A9A"],
    model: "formscape-style",
    popular: true,
    credits: 14,
    uploads: [SPACE],
    defaultCount: 2,
    promptTemplate: "多角度",
  }),
  skill({
    id: "storyboard",
    name: "分镜场景",
    desc: "空间叙事分镜 · 多镜头排布",
    category: "image",
    colors: ["#EDE9FE", "#C4B5FD", "#8B5CF6"],
    model: "fast-draft",
    credits: 10,
    uploads: [SPACE, REF],
    defaultCount: 4,
    promptTemplate: "分镜场景",
  }),
  skill({
    id: "sketch",
    name: "建筑手稿",
    desc: "手绘 / 线稿风格草图",
    category: "spaces",
    colors: ["#F3F4F6", "#D1D5DB", "#6B7280"],
    model: "fast-draft",
    credits: 6,
    uploads: [SPACE],
    promptTemplate: "建筑手稿",
  }),
  skill({
    id: "mood-palette",
    name: "情绪色板",
    desc: "从参考图提取情绪与色彩关键词",
    category: "design",
    colors: ["#FCE7F3", "#F9A8D4", "#BE185D"],
    model: "fast-draft",
    credits: 4,
    uploads: [REF],
    promptTemplate: "情绪色板",
  }),
  skill({
    id: "axon-view",
    name: "轴测图",
    desc: "生成建筑 / 室内轴测制图感",
    category: "spaces",
    colors: ["#ECFDF5", "#6EE7B7", "#047857"],
    model: "structure-safe",
    credits: 12,
    uploads: [SPACE],
    defaultAspect: "1:1",
    promptTemplate: "轴测图",
  }),
  skill({
    id: "floor-plan",
    name: "平面布局",
    desc: "室内平面功能分区建议图",
    category: "spaces",
    colors: ["#EFF6FF", "#93C5FD", "#1D4ED8"],
    model: "structure-safe",
    popular: true,
    credits: 10,
    uploads: [SPACE],
    defaultAspect: "1:1",
    promptTemplate: "平面布局",
  }),
  skill({
    id: "plan-aerial",
    name: "俯视鸟瞰",
    desc: "空间俯视 / 鸟瞰效果",
    category: "spaces",
    colors: ["#FEF3C7", "#FCD34D", "#B45309"],
    model: "formscape-style",
    credits: 10,
    uploads: [SPACE],
    defaultAspect: "16:9",
    promptTemplate: "俯视鸟瞰",
  }),
  skill({
    id: "style-ref",
    name: "风格参考延展",
    desc: "以一张参考图延展同风格新场景",
    category: "image",
    colors: ["#F5F0E8", "#D4C4B0", "#A89070"],
    model: "formscape-style",
    credits: 12,
    uploads: [
      { ...SPACE, required: true },
      { ...REF, required: true, label: "风格参考" },
    ],
    promptTemplate: "风格参考延展",
  }),
  skill({
    id: "material-swap",
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
    id: "product-replace",
    name: "产品替换",
    desc: "画面物件替换，场景结构保留",
    category: "product",
    colors: ["#F0EDE6", "#B8A890", "#6A6050"],
    model: "structure-safe",
    popular: true,
    credits: 14,
    uploads: [
      SPACE,
      { key: "product", label: "产品图", kind: "reference", required: true },
    ],
    promptTemplate: "产品替换",
  }),
  skill({
    id: "moodboard-extract",
    name: "意向提取",
    desc: "从参考图抽取色板与材质词",
    category: "design",
    colors: ["#F5F0E8", "#D4C4B0", "#A89070"],
    model: "fast-draft",
    credits: 4,
    uploads: [{ ...REF, required: true }],
    promptTemplate: "意向提取",
  }),
  skill({
    id: "cast-storyboard",
    name: "人物分镜",
    desc: "带人物动线的空间分镜",
    category: "image",
    colors: ["#DBEAFE", "#60A5FA", "#1E40AF"],
    hoverColors: ["#EFF6FF", "#93C5FD", "#1D4ED8"],
    model: "formscape-style",
    credits: 12,
    uploads: [SPACE, REF],
    defaultCount: 2,
    promptTemplate: "人物分镜",
  }),
  skill({
    id: "space-walkthrough",
    name: "空间漫游",
    desc: "室内镜头推进 / 环绕短片",
    category: "video",
    colors: ["#1E3A5F", "#3B82F6", "#93C5FD"],
    model: "formscape-motion",
    isNew: true,
    credits: 20,
    uploads: [SPACE, REF],
    defaultAspect: "16:9",
    defaultCount: 1,
    promptTemplate: "空间漫游",
  }),
  skill({
    id: "storyboard-clip",
    name: "分镜短片",
    desc: "方案讲解短视频",
    category: "video",
    colors: ["#312E81", "#6366F1", "#C7D2FE"],
    model: "storyboard-clip",
    credits: 24,
    uploads: [SPACE],
    defaultAspect: "16:9",
    promptTemplate: "分镜短片",
  }),
  skill({
    id: "massing-3d",
    name: "体块推敲",
    desc: "建筑体块 / 室内体量 3D 感",
    category: "3d",
    colors: ["#334155", "#94A3B8", "#E2E8F0"],
    model: "structure-safe",
    isNew: true,
    credits: 12,
    uploads: [SPACE],
    promptTemplate: "体块推敲",
  }),
  skill({
    id: "white-model",
    name: "白模渲染",
    desc: "白模上色与材质预演",
    category: "3d",
    colors: ["#F8FAFC", "#CBD5E1", "#64748B"],
    model: "structure-safe",
    popular: true,
    credits: 12,
    uploads: [
      { key: "space", label: "白模图", kind: "space", required: true },
      REF,
      MATERIAL,
    ],
    promptTemplate: "白模渲染",
  }),
];

for (const s of CANVAS_SKILLS) {
  if (!s.hoverColors) s.hoverColors = [...s.colors].reverse();
}

export const SKILLS_BY_ID = Object.fromEntries(CANVAS_SKILLS.map((s) => [s.id, s]));

/** Demo：根据技能 + 比例生成内部 prompt（不展示给用户） */
export function buildPromptFromSkill(
  skill: CanvasSkillDef,
  values: Record<string, string | number>
): string {
  const aspect = String(values.aspect ?? skill.defaultAspect);
  const count = values.count ?? skill.defaultCount;
  return `${skill.promptTemplate} · ${aspect} · ×${count}`;
}

/** @deprecated 兼容旧字段 API */
export function defaultFieldValues(skill: CanvasSkillDef): Record<string, string | number> {
  return {
    aspect: skill.defaultAspect,
    count: skill.defaultCount,
  };
}
