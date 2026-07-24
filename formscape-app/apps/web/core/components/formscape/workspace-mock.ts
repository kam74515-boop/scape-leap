/** 工作区级 Demo 数据（客户 / 资源库 / 团队） */

export type Customer = {
  id: string;
  name: string;
  phone: string;
  city: string;
  stage: "线索" | "量房" | "方案" | "施工" | "已交付";
  projectName: string;
  projectId: string;
  budgetWan: number;
  updatedAt: string;
};

export type LibraryItem = {
  id: string;
  kind: "灵感" | "材料" | "家具" | "户型";
  title: string;
  tags: string[];
  colors?: string[];
  brand?: string;
  price?: number;
};

export type TeamMember = {
  id: string;
  name: string;
  role: "管理员" | "主案设计师" | "深化" | "软装" | "助理";
  load: number; // 0-100
  email: string;
};

export const CUSTOMERS: Customer[] = [
  {
    id: "c1",
    name: "陈女士",
    phone: "138****6620",
    city: "杭州",
    stage: "方案",
    projectName: "滨江壹号 · 新婚两居",
    projectId: "proj-demo-1",
    budgetWan: 45,
    updatedAt: "2026-07-20",
  },
  {
    id: "c2",
    name: "王先生",
    phone: "139****1108",
    city: "上海",
    stage: "量房",
    projectName: "徐汇老宅改造",
    projectId: "proj-demo-1",
    budgetWan: 80,
    updatedAt: "2026-07-18",
  },
  {
    id: "c3",
    name: "李女士",
    phone: "136****8899",
    city: "苏州",
    stage: "线索",
    projectName: "园区湖景平层",
    projectId: "proj-demo-1",
    budgetWan: 60,
    updatedAt: "2026-07-15",
  },
];

export const LIBRARY: LibraryItem[] = [
  { id: "l1", kind: "灵感", title: "奶油石材客厅", tags: ["现代", "暖白"], colors: ["#F5F0E8", "#D4C4B0", "#8B7355"] },
  { id: "l2", kind: "灵感", title: "法式拱廊", tags: ["轻法", "拱形"], colors: ["#E8E4DC", "#C9B8A0", "#5C5346"] },
  { id: "l3", kind: "材料", title: "鱼肚白岩板", tags: ["地面"], brand: "冠珠", price: 680 },
  { id: "l4", kind: "材料", title: "橡木多层地板", tags: ["地面"], brand: "大自然", price: 420 },
  { id: "l5", kind: "家具", title: "三人布艺沙发", tags: ["客厅"], brand: "源氏木语", price: 8900 },
  { id: "l6", kind: "家具", title: "橡木餐桌 1.6m", tags: ["餐厅"], brand: "维莎", price: 4500 },
  { id: "l7", kind: "户型", title: "两室两厅 98㎡", tags: ["平层"], colors: ["#E8EEF5", "#C5D4E8", "#6B8AAD"] },
  { id: "l8", kind: "户型", title: "三室两厅 128㎡", tags: ["平层"], colors: ["#F0EDE6", "#D0C8B8", "#7A7060"] },
];

export const TEAM: TeamMember[] = [
  { id: "t1", name: "林设计师", role: "主案设计师", load: 78, email: "designer@formscape.local" },
  { id: "t2", name: "周深化", role: "深化", load: 55, email: "zhou@formscape.local" },
  { id: "t3", name: "赵软装", role: "软装", load: 40, email: "zhao@formscape.local" },
  { id: "t4", name: "钱助理", role: "助理", load: 30, email: "qian@formscape.local" },
];

export const WORKSPACE_META = {
  name: "构境工作室",
  plan: "Studio",
  seatsUsed: 4,
  seatsTotal: 10,
};
