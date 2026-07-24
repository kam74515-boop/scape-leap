/**
 * 从自然语言 / 技能名匹配 14 技能（Demo 路由）
 */
import { CANVAS_SKILLS, SKILLS_BY_ID, type CanvasSkillDef } from "./registry";

/** 关键词 → skillId（越具体越靠前） */
const KEYWORD_RULES: { re: RegExp; id: string }[] = [
  { re: /空房|毛坯|未装修|硬装空/, id: "unfurnished-space-generation" },
  { re: /白模/, id: "white-model-rendering" },
  { re: /多角度|多视角|换角度|转角/, id: "architectural-multi-angle" },
  { re: /轴测|等轴|鸟瞰轴/, id: "space-to-axonometric" },
  { re: /氛围|光影|气氛|时间段|夜间|清晨/, id: "space-atmosphere-transformation" },
  { re: /四季|季节|春夏秋冬|秋天|冬天|夏天|春天/, id: "seasonal-changes" },
  { re: /老房|旧改|翻新|改造前|改造后/, id: "old-house-renovation" },
  { re: /分镜|故事板|storyboard/, id: "multi-shot-storyboard" },
  { re: /手绘|线稿|手稿|草图/, id: "furniture-sketches" },
  { re: /情绪色|色板|色彩分析|mood/, id: "color-mood-analysis" },
  { re: /材质提取|提材质|材质分析/, id: "material-extraction-analysis" },
  { re: /材质替换|换材质|换面料|换地板|换墙/, id: "material-replacement" },
  { re: /产品灵感|灵感裂变|单品延展/, id: "product-inspiration-expansion" },
  { re: /模型生成|3d\s*模型|体块/, id: "model-generation" },
];

/** 选中图顶栏快捷技能（高频改图） */
export const QUICK_EDIT_SKILL_IDS = [
  "architectural-multi-angle",
  "space-atmosphere-transformation",
  "material-replacement",
  "white-model-rendering",
] as const;

export function getQuickEditSkills(): CanvasSkillDef[] {
  return QUICK_EDIT_SKILL_IDS.map((id) => SKILLS_BY_ID[id]).filter(Boolean) as CanvasSkillDef[];
}

/**
 * 匹配技能：优先全名/id 精确，再关键词，再模糊包含
 */
export function matchCanvasSkillFromText(text: string): CanvasSkillDef | null {
  const t = text.trim();
  if (!t) return null;

  // id 精确
  if (SKILLS_BY_ID[t]) return SKILLS_BY_ID[t];

  // 名称精确 / 包含
  const byName = CANVAS_SKILLS.find((s) => s.name === t || t.includes(s.name));
  if (byName) return byName;

  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(t)) {
      const s = SKILLS_BY_ID[rule.id];
      if (s) return s;
    }
  }

  // 英文 slug 片段
  const lower = t.toLowerCase();
  const bySlug = CANVAS_SKILLS.find((s) => lower.includes(s.id) || s.id.includes(lower.replace(/\s+/g, "-")));
  return bySlug ?? null;
}
