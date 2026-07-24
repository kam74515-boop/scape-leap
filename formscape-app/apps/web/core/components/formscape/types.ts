/** 构境产品域类型（前端-only，不依赖 formscape-demo） */

export type StageId =
  | "requirements"
  | "style"
  | "model"
  | "render"
  | "materials"
  | "furniture"
  | "construction";

export const STAGES: { id: StageId; label: string; desc: string }[] = [
  { id: "requirements", label: "需求分析", desc: "客户与房屋档案" },
  { id: "style", label: "风格设计", desc: "意向板与风格锚点" },
  { id: "model", label: "空间建模", desc: "户型与白模" },
  { id: "render", label: "AI 渲染", desc: "效果图生成" },
  { id: "materials", label: "材料选材", desc: "材质 SKU 清单" },
  { id: "furniture", label: "家具采买", desc: "家具配置" },
  { id: "construction", label: "施工落地", desc: "报价与工期" },
];

export type Profile = {
  clientName?: string;
  clientPhone?: string;
  clientNote?: string;
  houseType?: string;
  area?: number;
  budget?: number;
  style?: string;
  family?: string;
  rooms?: string;
  city?: string;
  timeline?: string;
};

export type FormscapeProject = {
  id: string;
  name: string;
  identifier: string;
  stage: StageId;
  profile: Profile;
  moodboard: { id: string; title: string; tags: string[]; colors: string[] }[];
  materials: { id: string; name: string; category: string; brand: string; price: number }[];
  furniture: { id: string; name: string; category: string; brand: string; price: number }[];
  purchaseIds: string[];
};

export function isStageId(v: string): v is StageId {
  return STAGES.some((s) => s.id === v);
}
