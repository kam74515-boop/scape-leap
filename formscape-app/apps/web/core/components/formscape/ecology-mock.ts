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

/** URL ?cat= 兼容：既接受 key（sofa）也接受中文品类值（沙发） */
export function resolveEcoCategoryKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (ECO_CATEGORIES.some((c) => c.key === v)) return v;
  const byLabel = ECO_CATEGORIES.find((c) => c.label === v);
  if (byLabel) return byLabel.key;
  // 数据里的品类原值（如「茶几」「家纺」）→ 反查 CATEGORY_MAP
  for (const [key, labels] of Object.entries(CATEGORY_MAP)) {
    if (labels.some((l) => l === v || l.includes(v) || v.includes(l))) return key;
  }
  return null;
}

/* ─── 真筛选：按数据现有字段（风格 / 材质 / 价格区间）───────────── */

export type EcoFilterKey = "style" | "material" | "price";

export type EcoFilterDef = {
  key: EcoFilterKey;
  label: string;
  options: { value: string; label: string }[];
};

export type EcoFilterState = Partial<Record<EcoFilterKey, string | null>>;

/** 价格区间（数据实际价格 76 – 45209 元） */
export const ECO_PRICE_BUCKETS: { value: string; label: string; min: number; max: number }[] = [
  { value: "0-500", label: "500 元以下", min: 0, max: 500 },
  { value: "500-2000", label: "500 – 2000 元", min: 500, max: 2000 },
  { value: "2000-5000", label: "2000 – 5000 元", min: 2000, max: 5000 },
  { value: "5000-10000", label: "5000 – 1 万元", min: 5000, max: 10000 },
  { value: "10000-", label: "1 万元以上", min: 10000, max: Infinity },
];

function uniqueValues(pick: (p: EcoProduct) => string | undefined): string[] {
  const count = new Map<string, number>();
  for (const p of ECO_PRODUCTS) {
    const v = pick(p);
    if (!v) continue;
    count.set(v, (count.get(v) ?? 0) + 1);
  }
  return Array.from(count.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v);
}

/** 下拉筛选定义：全部选项从 mock 数据实际字段推导，选了就真生效 */
export const ECO_FILTER_DEFS: EcoFilterDef[] = [
  {
    key: "style",
    label: "风格",
    options: uniqueValues((p) => p.style).map((v) => ({ value: v, label: v })),
  },
  {
    key: "material",
    label: "材质",
    options: uniqueValues((p) => p.material)
      .slice(0, 12)
      .map((v) => ({ value: v, label: v })),
  },
  {
    key: "price",
    label: "价格区间",
    options: ECO_PRICE_BUCKETS.map((b) => ({ value: b.value, label: b.label })),
  },
];

/** @deprecated 旧死下拉占位标签，改用 ECO_FILTER_DEFS（真筛选） */
export const ECO_FILTERS = ECO_FILTER_DEFS.map((f) => f.label);

function matchEcoPrice(price: number, bucketValue: string): boolean {
  const bucket = ECO_PRICE_BUCKETS.find((b) => b.value === bucketValue);
  if (!bucket) return true;
  return price >= bucket.min && price < bucket.max;
}

export function filterEcoProducts(
  products: EcoProduct[],
  categoryKey: string,
  brand: string,
  filters?: EcoFilterState
): EcoProduct[] {
  if (categoryKey === "combo") return [];
  return products.filter((p) => {
    const labels = CATEGORY_MAP[categoryKey];
    const matchCat =
      !categoryKey ||
      !labels ||
      labels.some((l) => p.category.includes(l) || l.includes(p.category));
    const matchBrand = brand === "全部" || p.brand === brand;
    const matchStyle = !filters?.style || p.style === filters.style;
    const matchMaterial = !filters?.material || p.material === filters.material;
    const matchPrice = !filters?.price || matchEcoPrice(p.price, filters.price);
    return matchCat && matchBrand && matchStyle && matchMaterial && matchPrice;
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
