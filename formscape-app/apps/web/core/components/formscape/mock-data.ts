import type { FormscapeProject } from "./types";

/** 与 mock-api 项目 id 对齐 */
export const DEMO_PROJECT: FormscapeProject = {
  id: "proj-demo-1",
  name: "滨江壹号 · 新婚两居",
  identifier: "BJ",
  stage: "style",
  profile: {
    clientName: "陈女士",
    clientPhone: "138****6620",
    clientNote: "周末量房 · 决策人夫妻双方",
    houseType: "平层",
    area: 98,
    budget: 45,
    style: "现代轻法",
    family: "两口之家",
    rooms: "两室两厅",
    city: "杭州",
    timeline: "2026 Q4 入住",
  },
  moodboard: [
    { id: "s1", title: "奶油石材客厅", tags: ["现代", "暖白"], colors: ["#F5F0E8", "#D4C4B0", "#8B7355"] },
    { id: "s2", title: "法式拱廊", tags: ["轻法", "拱形"], colors: ["#E8E4DC", "#C9B8A0", "#5C5346"] },
    { id: "s3", title: "橡木与亚麻", tags: ["自然", "软装"], colors: ["#EDE6D9", "#C4A574", "#6B5B4F"] },
  ],
  materials: [
    { id: "m1", name: "鱼肚白岩板", category: "地面", brand: "冠珠", price: 680 },
    { id: "m2", name: "橡木多层地板", category: "地面", brand: "大自然", price: 420 },
    { id: "m3", name: "微水泥墙面", category: "墙面", brand: "立邦", price: 280 },
    { id: "m4", name: "黄铜灯具套装", category: "灯具", brand: "欧普", price: 3200 },
  ],
  furniture: [
    { id: "f1", name: "三人布艺沙发", category: "客厅", brand: "源氏木语", price: 8900 },
    { id: "f2", name: "橡木餐桌 1.6m", category: "餐厅", brand: "维莎", price: 4500 },
    { id: "f3", name: "悬浮床 1.8m", category: "卧室", brand: "源氏木语", price: 6200 },
  ],
  purchaseIds: ["m1", "m2", "f1"],
};

const STORAGE_KEY = "formscape.demo.project.v1";

export function loadProject(): FormscapeProject {
  if (typeof window === "undefined") return DEMO_PROJECT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEMO_PROJECT, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEMO_PROJECT, profile: { ...DEMO_PROJECT.profile }, purchaseIds: [...DEMO_PROJECT.purchaseIds] };
}

export function saveProject(p: FormscapeProject) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
