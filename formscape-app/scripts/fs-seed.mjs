/**
 * 构境 SQLite 种子数据（emoji-free）。
 * 从 apps/web 的 TS mock（pm-mock / workspace-mock / files-store）迁移而来；
 * 首次启动建库时播种，此后唯一真源 = data/formscape.db。
 */

const now = () => new Date().toISOString();

/* 与 tasks-store 一致的相对日期解析 */
function addDaysKey(base, offset) {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function seedDueOffset(due) {
  if (due.includes("今天")) return 0;
  if (due.includes("明天")) return 1;
  if (due.includes("周三")) return 2;
  if (due.includes("周五")) return 4;
  if (due.includes("下周一")) return 7;
  if (due.includes("下周三")) return 9;
  if (due.includes("已完成")) return -1;
  if (due.includes("下周")) return 8;
  if (due.includes("本周")) return 3;
  return 2;
}

const TASK_SEEDS = [
  ["t1", "BJ-12", "整理客户量房照片与备注", "proj-demo-1", "requirements", "需求分析", "high", "in_progress", "林设计师", "今天"],
  ["t2", "BJ-18", "输出客厅 moodboard 3 版", "proj-demo-1", "style", "风格设计", "urgent", "todo", "林设计师", "明天"],
  ["t3", "BJ-9", "材料清单一版给客户确认", "proj-demo-1", "materials", "材料选材", "medium", "todo", "周软装", "下周一"],
  ["t4", "BJ-21", "主卧收纳方案内部评审", "proj-demo-1", "model", "空间建模", "high", "review", "阿凯深化", "周三"],
  ["t5", "BJ-7", "量房图纸核对完成", "proj-demo-1", "requirements", "需求分析", "medium", "done", "林设计师", "已完成"],
  ["t6", "BJ-15", "客户确认风格方向 A/B", "proj-demo-1", "style", "风格设计", "urgent", "review", "林设计师", "今天"],
  ["t7", "BJ-3", "首期设计费到账确认", "proj-demo-1", null, "经营·首期款", "high", "done", "林设计师", "已完成"],
  ["t8", "BJ-22", "厨房动线推演一版", "proj-demo-1", "model", "空间建模", "medium", "todo", "阿凯深化", "下周三"],
  ["t9", "XH-3", "约量房时间并确认决策人", "proj-demo-2", "requirements", "需求分析", "medium", "todo", "林设计师", "本周五"],
  ["t10", "XH-1", "结构评估纪要归档", "proj-demo-2", "requirements", "需求分析", "low", "done", "林设计师", "已完成"],
  ["t11", "XH-4", "历史改造照片归类", "proj-demo-2", "requirements", "需求分析", "low", "in_progress", "结构顾问", "本周"],
  ["t12", "XH-5", "客户预算区间确认", "proj-demo-2", "requirements", "需求分析", "high", "todo", "林设计师", "下周"],
  ["t13", "YQ-1", "电话回访线索意向", "proj-demo-3", null, "经营·线索", "low", "in_progress", "林设计师", "本周"],
  ["t14", "YQ-2", "发送工作室介绍与案例包", "proj-demo-3", null, "经营·线索", "medium", "todo", "林设计师", "明天"],
];

export function seedTasks() {
  const today = new Date();
  return TASK_SEEDS.map(([id, key, title, projectId, stageId, stageLabel, priority, state, assignee, due]) => {
    const off = seedDueOffset(due);
    return {
      id,
      key,
      title,
      projectId,
      stageId,
      stageLabel,
      priority,
      state,
      assignee,
      startDate: addDaysKey(today, off - 2),
      dueDate: addDaysKey(today, off),
      createdAt: now(),
      source: "seed",
    };
  });
}

export const SEED_DRAFTS = [
  { id: "d1", title: "卫生间防水节点说明（待完善）", projectId: "proj-demo-1", projectName: "滨江壹号 · 新婚两居", updatedAt: "2 小时前", note: "从纪要抽出 · 尚未正式创建任务", kind: "任务" },
  { id: "d2", title: "软装采购对比表草稿", projectId: "proj-demo-1", projectName: "滨江壹号 · 新婚两居", updatedAt: "昨天", note: "缺三家报价 · AI 已填骨架", kind: "清单" },
  { id: "d3", title: "老宅结构评估清单", projectId: "proj-demo-2", projectName: "徐汇老宅改造", updatedAt: "3 天前", note: "待与深化确认后发布", kind: "清单" },
  { id: "d4", title: "设计费分期条款 · 草稿", projectId: "proj-demo-1", projectName: "滨江壹号 · 新婚两居", updatedAt: "昨天", note: "签约 40% / 效果图 30% / 交底 30%", kind: "报价" },
  { id: "d5", title: "未归属：下周例会待办", projectId: null, projectName: null, updatedAt: "10 分钟前", note: "AI 从对话整理", kind: "任务" },
];

/* 客户种子（customers-store.CustomerRecord 形状：projectIds[] + notes[]） */
function seedCustomer(id, name, phone, wechat, source, city, stage, projectId, budgetWan, note, noteDate) {
  const t = now();
  return {
    id,
    name,
    phone,
    wechat,
    source,
    city,
    stage,
    budgetWan,
    projectIds: projectId ? [projectId] : [],
    notes: note ? [{ id: `${id}-n1`, text: note, at: `${noteDate}T09:00:00.000Z` }] : [],
    createdAt: t,
    updatedAt: t,
  };
}
export const SEED_CUSTOMERS = [
  seedCustomer("c1", "陈女士", "138****6620", "chen_home2026", "小红书", "杭州", "方案", "proj-demo-1", 45, "婚房刚需，偏好奶油风，10 月前入住", "2026-07-20"),
  seedCustomer("c2", "王先生", "139****1108", "wang_sh_1972", "朋友介绍", "上海", "量房", "proj-demo-2", 80, "老洋房结构复杂，先做结构评估再谈方案", "2026-07-18"),
  seedCustomer("c3", "李女士", "136****8899", "lily_sz", "线下活动", "苏州", "线索", "proj-demo-3", 60, "看过案例包，预算区间待确认", "2026-07-15"),
  seedCustomer("c4", "赵先生", "137****3355", "zhao_hz", "老客户转介绍", "杭州", "施工", "proj-demo-1", 52, "工地在同小区，可与陈女士项目共用监理", "2026-07-12"),
  seedCustomer("c5", "孙女士", "135****7702", "sun_design_fan", "小红书", "上海", "已交付", "proj-demo-2", 96, "已交付 · 等回访拍摄实景案例", "2026-06-30"),
];

export const SEED_MEMBERS = [
  { id: "t1", name: "林设计师", role: "主案设计师", load: 78, email: "designer@formscape.local" },
  { id: "t2", name: "周深化", role: "深化", load: 55, email: "zhou@formscape.local" },
  { id: "t3", name: "赵软装", role: "软装", load: 40, email: "zhao@formscape.local" },
  { id: "t4", name: "钱助理", role: "助理", load: 30, email: "qian@formscape.local" },
];

/** 工作室项目目录（项目元数据唯一真源） */
export const SEED_PROJECTS = [
  {
    id: "proj-demo-1",
    name: "滨江壹号 · 新婚两居",
    identifier: "BJ",
    stageLabel: "风格设计",
    stageId: "style",
    clientName: "陈女士",
    city: "杭州",
    houseType: "两室一厅 · 89㎡",
    progress: 42,
    openTasks: 8,
    overdueTasks: 1,
    budgetWan: 45,
    designFeeWan: 3.8,
    feeCollectedWan: 1.5,
    updatedAt: "今天 14:20",
    risk: "关注",
    owner: "林设计师",
    members: ["林设计师", "周软装", "阿凯深化"],
  },
  {
    id: "proj-demo-2",
    name: "徐汇老宅改造",
    identifier: "XH",
    stageLabel: "需求分析",
    stageId: "requirements",
    clientName: "王先生",
    city: "上海",
    houseType: "老洋房 · 162㎡",
    progress: 15,
    openTasks: 5,
    overdueTasks: 0,
    budgetWan: 80,
    designFeeWan: 6.5,
    feeCollectedWan: 2,
    updatedAt: "昨天 18:05",
    risk: "正常",
    owner: "林设计师",
    members: ["林设计师", "结构顾问"],
  },
  {
    id: "proj-demo-3",
    name: "园区湖景平层",
    identifier: "YQ",
    stageLabel: "线索",
    stageId: "requirements",
    clientName: "李女士",
    city: "苏州",
    houseType: "平层 · 138㎡",
    progress: 5,
    openTasks: 2,
    overdueTasks: 0,
    budgetWan: 60,
    designFeeWan: 4.2,
    feeCollectedWan: 0,
    updatedAt: "3 天前",
    risk: "正常",
    owner: "林设计师",
    members: ["林设计师"],
  },
];

/* 项目双轴进度种子（与 project-progress-store.seedForProject 同逻辑） */
const STAGE_IDS = ["requirements", "style", "model", "render", "materials", "furniture", "construction"];
function defaultStageStates(focus) {
  const idx = STAGE_IDS.indexOf(focus);
  const map = {};
  STAGE_IDS.forEach((s, i) => {
    map[s] = i < idx ? "confirmed" : i === idx ? "in_progress" : "not_started";
  });
  return map;
}
const PROGRESS_SEEDS = [
  { projectId: "proj-demo-1", focus: "style", bizDoneMax: 3, designFeeWan: 3.8 },
  { projectId: "proj-demo-2", focus: "requirements", bizDoneMax: 1, designFeeWan: 6.5 },
  { projectId: "proj-demo-3", focus: "requirements", bizDoneMax: 0, designFeeWan: 4.2 },
];
export function seedProgress() {
  return PROGRESS_SEEDS.map((p) => ({
    id: p.projectId,
    stageStates: defaultStageStates(p.focus),
    focusStage: p.focus,
    bizDoneMax: p.bizDoneMax,
    designFeeWan: p.designFeeWan,
    staleStages: [],
    updatedAt: now(),
  }));
}

/* 项目图板默认分类板（轻量种子图，与 style-boards-store.defaultBoardsForProject 同源素材路径） */
function seedPin(id, kind, title, src, colors, tags) {
  return { id, kind, title, src, colors, tags, sourceLabel: "图板种子", addedAt: now() };
}
export function seedStyleBoards() {
  const boards = [];
  for (const pid of ["proj-demo-1", "proj-demo-2", "proj-demo-3"]) {
    boards.push({
      id: `${pid}-board-style`,
      projectId: pid,
      category: "style",
      name: "风格参考",
      pins: [
        seedPin(`${pid}-pin-1`, "reference", "风格参考 · 暖白客厅", "/formscape-skill-mocks/unfurnished-space-generation/case-01/out0.jpg", ["#F5F0E8", "#D4C4B0", "#8B7355"], ["风格", "客厅"]),
        seedPin(`${pid}-pin-2`, "reference", "风格参考 · 氛围光影", "/formscape-skill-mocks/space-atmosphere-transformation/case-01/out0.jpg", ["#EDE9FE", "#C4B5FD", "#7C3AED"], ["风格", "氛围"]),
      ],
      updatedAt: now(),
    });
    for (const [cat, name] of [["product", "产品选品"], ["material", "材质样板"], ["camera", "镜头设定"]]) {
      boards.push({ id: `${pid}-board-${cat}`, projectId: pid, category: cat, name, pins: [], updatedAt: now() });
    }
  }
  return boards;
}

export const SEED_FILES = [
  { id: "seed-f1", projectId: "proj-demo-1", name: "量房平面图.pdf", kind: "图纸", stageId: "requirements", sizeLabel: "2.4 MB", date: "2026-07-10", mime: "application/pdf", seed: true },
  { id: "seed-f2", projectId: "proj-demo-1", name: "风格意向板-v2.png", kind: "效果图", stageId: "style", sizeLabel: "4.1 MB", date: "2026-07-18", mime: "image/png", seed: true },
  { id: "seed-f3", projectId: "proj-demo-1", name: "材料清单.xlsx", kind: "清单", stageId: "materials", sizeLabel: "180 KB", date: "2026-07-19", mime: "application/vnd.ms-excel", seed: true },
  { id: "seed-f4", projectId: "proj-demo-1", name: "设计合同-草稿.docx", kind: "合同", stageId: null, sizeLabel: "96 KB", date: "2026-07-08", mime: "application/msword", seed: true },
];

/* 采购清单种子（purchase-store.seedLines 同源：生态库前 4 个产品快照） */
export function seedPurchaseLines() {
  const t = now();
  const line = (id, productId, name, brand, price, image, category, qty, projectId, projectName, status) => ({
    id, productId, name, brand, price, image, category, qty, projectId, projectName, status, addedAt: t,
  });
  return [
    line("pl-seed-1", "p1", "Matte Onyx Serving Set", "Firefly Home", 317, "/crawled_images/product_p1.jpg", "地毯", 1, "proj-demo-1", "滨江壹号 · 新婚两居", "quoted"),
    line("pl-seed-2", "p2", "Matte Gold Cheese Knife", "Aster Living", 115, "/crawled_images/product_p2.jpg", "地毯", 2, "proj-demo-1", "滨江壹号 · 新婚两居", "draft"),
    line("pl-seed-3", "p3", "Matte Onyx Cheese Knife", "Nordic Lab", 86, "/crawled_images/product_p3.jpg", "地毯", 1, "proj-demo-2", "徐汇老宅改造", "ordered"),
    line("pl-seed-4", "p4", "Matte Gold Bottle Opener", "Lumina", 115, "/crawled_images/product_p4.jpg", "地毯", 1, null, null, "draft"),
  ];
}

/** 项目档案（mock-data.ts DEMO_PROJECT 同源：需求分析页可编辑档案） */
export const SEED_DEMO_PROJECT = {
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

/** 默认空间场景（与 space-model-store 初始形状一致） */
export const SEED_SPACE_SCENE = {
  id: "scene-default",
  name: "未命名空间",
  source: "blank",
  sourceFileName: null,
  projectId: null,
  projectName: null,
  widthMm: 10000,
  depthMm: 8000,
  wallHeightMm: 2800,
  walls: [],
  placements: [],
  detectMethod: null,
  detectStrictness: 50,
  detectFull: null,
  detectMessage: null,
  updatedAt: now(),
};
