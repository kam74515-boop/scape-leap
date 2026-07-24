/**
 * 3D 空间 · 图块库与户型模板（Demo）
 * 图块用于平面布局；真实 3D mesh 后续接 glTF
 */

export type BlockCategory = "structure" | "opening" | "kitchen" | "bath" | "furniture";

export type SpaceBlockDef = {
  id: string;
  label: string;
  category: BlockCategory;
  /** 平面占位 mm */
  wMm: number;
  dMm: number;
  /** 默认层高相关提示 */
  hMm?: number;
  color: string;
  /** 是否结构（墙/柱） */
  structural?: boolean;
};

export const BLOCK_CATEGORIES: { key: BlockCategory; label: string }[] = [
  { key: "structure", label: "结构" },
  { key: "opening", label: "门窗" },
  { key: "kitchen", label: "厨房" },
  { key: "bath", label: "卫浴" },
  { key: "furniture", label: "家具" },
];

export const SPACE_BLOCKS: SpaceBlockDef[] = [
  { id: "wall_seg", label: "墙段", category: "structure", wMm: 2000, dMm: 120, hMm: 2800, color: "#64748b", structural: true },
  { id: "col", label: "方柱", category: "structure", wMm: 400, dMm: 400, hMm: 2800, color: "#475569", structural: true },
  { id: "door", label: "单开门", category: "opening", wMm: 900, dMm: 200, hMm: 2100, color: "#a78bfa" },
  { id: "door_dbl", label: "双开门", category: "opening", wMm: 1600, dMm: 200, hMm: 2100, color: "#8b5cf6" },
  { id: "win", label: "平开窗", category: "opening", wMm: 1500, dMm: 150, hMm: 1400, color: "#38bdf8" },
  { id: "cab_base", label: "地柜", category: "kitchen", wMm: 800, dMm: 600, hMm: 800, color: "#fbbf24" },
  { id: "cab_wall", label: "吊柜", category: "kitchen", wMm: 800, dMm: 350, hMm: 700, color: "#f59e0b" },
  { id: "sink", label: "水槽", category: "kitchen", wMm: 800, dMm: 600, hMm: 850, color: "#94a3b8" },
  { id: "toilet", label: "马桶", category: "bath", wMm: 400, dMm: 700, hMm: 800, color: "#e2e8f0" },
  { id: "shower", label: "淋浴", category: "bath", wMm: 900, dMm: 900, hMm: 2000, color: "#bae6fd" },
  { id: "vanity", label: "浴室柜", category: "bath", wMm: 800, dMm: 500, hMm: 850, color: "#cbd5e1" },
  { id: "sofa", label: "三人沙发", category: "furniture", wMm: 2200, dMm: 900, hMm: 850, color: "#c4b5fd" },
  { id: "table", label: "餐桌", category: "furniture", wMm: 1400, dMm: 800, hMm: 750, color: "#d6d3d1" },
  { id: "bed", label: "双人床", category: "furniture", wMm: 1800, dMm: 2000, hMm: 500, color: "#fda4af" },
  { id: "desk", label: "书桌", category: "furniture", wMm: 1200, dMm: 600, hMm: 750, color: "#fdba74" },
  { id: "tv", label: "电视柜", category: "furniture", wMm: 1800, dMm: 400, hMm: 450, color: "#a8a29e" },
];

export type RoomTemplateId = "empty" | "1br" | "2br" | "studio";

export type RoomTemplate = {
  id: RoomTemplateId;
  label: string;
  desc: string;
  /** 外轮廓宽高 mm */
  widthMm: number;
  depthMm: number;
};

export const ROOM_TEMPLATES: RoomTemplate[] = [
  { id: "empty", label: "空白", desc: "仅画布，自行导入/绘制", widthMm: 10000, depthMm: 8000 },
  { id: "studio", label: "开间", desc: "约 40㎡ 开间壳", widthMm: 8000, depthMm: 5000 },
  { id: "1br", label: "一居", desc: "约 55㎡ 一室一厅", widthMm: 9000, depthMm: 7000 },
  { id: "2br", label: "两居", desc: "约 89㎡ 两室一厅", widthMm: 11000, depthMm: 8500 },
];

export function blockById(id: string): SpaceBlockDef | undefined {
  return SPACE_BLOCKS.find((b) => b.id === id);
}
