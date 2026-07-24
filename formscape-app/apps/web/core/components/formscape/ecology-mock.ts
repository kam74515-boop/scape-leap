/**
 * 生态库数据层
 * 商品/组合/案例/空间来自 ark Mini program mock（ecology-data.json）
 * 图片：/crawled_images/* → apps/web/public/crawled_images（symlink）
 */
import raw from "./ecology-data.json";

export type EcoMode = "products" | "combos" | "cases" | "spaces" | "purchase";

export type EcoProduct = {
  id: string;
  name: string;
  brand: string;
  price: number;
  category: string;
  style: string;
  material: string;
  tag?: string;
  dimension?: string;
  stock?: string;
  delivery?: string;
  matchScore?: number | null;
  image: string;
  colors?: string[];
};

export type EcoCombo = {
  id: string;
  name: string;
  meta: string;
  price: number;
  itemCount: number;
  room: string;
  budget: string;
  styleTags: string[];
  highlights: string[];
  image: string;
  productIds: string[];
};

export type EcoCase = {
  id: string;
  title: string;
  meta: string;
  tags: string[];
  desc: string;
  area: string;
  budget: string;
  image: string;
};

export type EcoSpace = {
  id: string;
  name: string;
  type: string;
  area: string;
  light: string;
  image: string;
};

export const ECO_MODES: { key: EcoMode; label: string }[] = [
  { key: "products", label: "单品" },
  { key: "combos", label: "组合" },
  { key: "cases", label: "案例" },
  { key: "spaces", label: "空间模板" },
  { key: "purchase", label: "采购" },
];

/** 品类 chips：key 与筛选逻辑对齐 ark */
export const ECO_CATEGORIES = [
  { key: "sofa", label: "沙发" },
  { key: "combo", label: "组合" },
  { key: "table", label: "茶几" },
  { key: "bed", label: "床" },
  { key: "light", label: "灯具" },
  { key: "carpet", label: "地毯" },
  { key: "chair", label: "餐椅" },
  { key: "cabinet", label: "柜类" },
  { key: "decor", label: "装饰" },
] as const;

export const ECO_FILTERS = ["风格", "材质", "适用空间", "环保等级", "颜色", "发布时间"] as const;

const data = raw as {
  products: EcoProduct[];
  combos: EcoCombo[];
  cases: EcoCase[];
  spaces: EcoSpace[];
  brands: string[];
  categories: string[];
};

export const ECO_PRODUCTS: EcoProduct[] = data.products;
export const ECO_COMBOS: EcoCombo[] = data.combos;
export const ECO_CASES: EcoCase[] = data.cases;
export const ECO_SPACES: EcoSpace[] = data.spaces;

export const ECO_BRANDS: string[] = ["全部", ...data.brands];

const CATEGORY_MAP: Record<string, string[]> = {
  sofa: ["沙发"],
  table: ["茶几", "桌类"],
  bed: ["床"],
  light: ["灯具"],
  carpet: ["地毯", "家纺"],
  chair: ["餐椅"],
  cabinet: ["柜类"],
  decor: ["装饰"],
};

export function filterEcoProducts(
  products: EcoProduct[],
  categoryKey: string,
  brand: string
): EcoProduct[] {
  if (categoryKey === "combo") return [];
  return products.filter((p) => {
    const labels = CATEGORY_MAP[categoryKey];
    const matchCat =
      !categoryKey ||
      !labels ||
      labels.some((l) => p.category.includes(l) || l.includes(p.category));
    const matchBrand = brand === "全部" || p.brand === brand;
    return matchCat && matchBrand;
  });
}

/** 占位渐变（无图时） */
export function ecoFallbackGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const a = `hsl(${h % 360} 18% 82%)`;
  const b = `hsl(${(h + 40) % 360} 16% 68%)`;
  return `linear-gradient(145deg, ${a}, ${b})`;
}
