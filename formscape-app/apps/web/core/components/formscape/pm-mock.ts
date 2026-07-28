/** 项目管理 Demo 数据：首页仪表盘 / 我的工作 / 草稿 / 项目任务 */

export type PmProject = {
  id: string;
  name: string;
  identifier: string;
  stageLabel: string;
  stageId: string;
  clientName: string;
  city: string;
  houseType: string;
  progress: number;
  openTasks: number;
  overdueTasks: number;
  budgetWan: number;
  designFeeWan: number;
  feeCollectedWan: number;
  updatedAt: string;
  risk: "正常" | "关注" | "延期";
  owner: string;
  members: string[];
};

export type MyAssignment = {
  id: string;
  key: string;
  title: string;
  projectId: string;
  projectName: string;
  stageLabel: string;
  priority: "urgent" | "high" | "medium" | "low";
  state: "todo" | "in_progress" | "review" | "done";
  dueDate: string;
  assignee: string;
};

export type DraftItem = {
  id: string;
  title: string;
  projectId: string | null;
  projectName: string | null;
  updatedAt: string;
  note: string;
  kind: "任务" | "纪要" | "清单" | "报价";
};

export type ProjectTask = {
  id: string;
  key: string;
  title: string;
  projectId: string;
  /** 关联设计阶段；经营类任务可为空（仅 stageLabel 展示） */
  stageId: string | null;
  stageLabel: string;
  priority: "urgent" | "high" | "medium" | "low";
  state: "todo" | "in_progress" | "review" | "done";
  assignee: string;
  dueDate: string;
};

export const PM_PROJECTS: PmProject[] = [
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
    feeCollectedWan: 2.0,
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

export const MY_ASSIGNMENTS: MyAssignment[] = [
  {
    id: "a1",
    key: "BJ-12",
    title: "整理客户量房照片与备注",
    projectId: "proj-demo-1",
    projectName: "滨江壹号 · 新婚两居",
    stageLabel: "需求分析",
    priority: "high",
    state: "in_progress",
    dueDate: "今天",
    assignee: "林设计师",
  },
  {
    id: "a2",
    key: "BJ-18",
    title: "输出客厅 moodboard 3 版",
    projectId: "proj-demo-1",
    projectName: "滨江壹号 · 新婚两居",
    stageLabel: "风格设计",
    priority: "urgent",
    state: "todo",
    dueDate: "明天",
    assignee: "林设计师",
  },
  {
    id: "a3",
    key: "XH-3",
    title: "约量房时间并确认决策人",
    projectId: "proj-demo-2",
    projectName: "徐汇老宅改造",
    stageLabel: "需求分析",
    priority: "medium",
    state: "todo",
    dueDate: "本周五",
    assignee: "林设计师",
  },
  {
    id: "a4",
    key: "BJ-9",
    title: "材料清单一版给客户确认",
    projectId: "proj-demo-1",
    projectName: "滨江壹号 · 新婚两居",
    stageLabel: "材料选材",
    priority: "medium",
    state: "todo",
    dueDate: "下周一",
    assignee: "周软装",
  },
  {
    id: "a5",
    key: "YQ-1",
    title: "电话回访线索意向",
    projectId: "proj-demo-3",
    projectName: "园区湖景平层",
    stageLabel: "线索",
    priority: "low",
    state: "in_progress",
    dueDate: "本周",
    assignee: "林设计师",
  },
  {
    id: "a6",
    key: "BJ-21",
    title: "主卧收纳方案内部评审",
    projectId: "proj-demo-1",
    projectName: "滨江壹号 · 新婚两居",
    stageLabel: "深化设计",
    priority: "high",
    state: "review",
    dueDate: "周三",
    assignee: "阿凯深化",
  },
  {
    id: "a7",
    key: "XH-1",
    title: "结构评估纪要归档",
    projectId: "proj-demo-2",
    projectName: "徐汇老宅改造",
    stageLabel: "需求分析",
    priority: "low",
    state: "done",
    dueDate: "已完成",
    assignee: "林设计师",
  },
];

export const DRAFT_ITEMS: DraftItem[] = [
  {
    id: "d1",
    title: "卫生间防水节点说明（待完善）",
    projectId: "proj-demo-1",
    projectName: "滨江壹号 · 新婚两居",
    updatedAt: "2 小时前",
    note: "从纪要抽出 · 尚未正式创建任务",
    kind: "任务",
  },
  {
    id: "d2",
    title: "软装采购对比表草稿",
    projectId: "proj-demo-1",
    projectName: "滨江壹号 · 新婚两居",
    updatedAt: "昨天",
    note: "缺三家报价 · AI 已填骨架",
    kind: "清单",
  },
  {
    id: "d3",
    title: "老宅结构评估清单",
    projectId: "proj-demo-2",
    projectName: "徐汇老宅改造",
    updatedAt: "3 天前",
    note: "待与深化确认后发布",
    kind: "清单",
  },
  {
    id: "d4",
    title: "设计费分期条款 · 草稿",
    projectId: "proj-demo-1",
    projectName: "滨江壹号 · 新婚两居",
    updatedAt: "昨天",
    note: "签约 40% / 效果图 30% / 交底 30%",
    kind: "报价",
  },
  {
    id: "d5",
    title: "未归属：下周例会待办",
    projectId: null,
    projectName: null,
    updatedAt: "上周",
    note: "未关联项目 · 可分配后发布",
    kind: "纪要",
  },
];

/** 项目内任务（按 projectId 过滤；stageId 绑定设计阶段，经营类为 null） */
export const PROJECT_TASKS: ProjectTask[] = [
  {
    id: "t1",
    key: "BJ-12",
    title: "整理客户量房照片与备注",
    projectId: "proj-demo-1",
    stageId: "requirements",
    stageLabel: "需求分析",
    priority: "high",
    state: "in_progress",
    assignee: "林设计师",
    dueDate: "今天",
  },
  {
    id: "t2",
    key: "BJ-18",
    title: "输出客厅 moodboard 3 版",
    projectId: "proj-demo-1",
    stageId: "style",
    stageLabel: "风格设计",
    priority: "urgent",
    state: "todo",
    assignee: "林设计师",
    dueDate: "明天",
  },
  {
    id: "t3",
    key: "BJ-9",
    title: "材料清单一版给客户确认",
    projectId: "proj-demo-1",
    stageId: "materials",
    stageLabel: "材料选材",
    priority: "medium",
    state: "todo",
    assignee: "周软装",
    dueDate: "下周一",
  },
  {
    id: "t4",
    key: "BJ-21",
    title: "主卧收纳方案内部评审",
    projectId: "proj-demo-1",
    stageId: "model",
    stageLabel: "空间建模",
    priority: "high",
    state: "review",
    assignee: "阿凯深化",
    dueDate: "周三",
  },
  {
    id: "t5",
    key: "BJ-7",
    title: "量房图纸核对完成",
    projectId: "proj-demo-1",
    stageId: "requirements",
    stageLabel: "需求分析",
    priority: "medium",
    state: "done",
    assignee: "林设计师",
    dueDate: "已完成",
  },
  {
    id: "t6",
    key: "BJ-15",
    title: "客户确认风格方向 A/B",
    projectId: "proj-demo-1",
    stageId: "style",
    stageLabel: "风格设计",
    priority: "urgent",
    state: "review",
    assignee: "林设计师",
    dueDate: "今天",
  },
  {
    id: "t7",
    key: "BJ-3",
    title: "首期设计费到账确认",
    projectId: "proj-demo-1",
    stageId: null,
    stageLabel: "经营·首期款",
    priority: "high",
    state: "done",
    assignee: "林设计师",
    dueDate: "已完成",
  },
  {
    id: "t8",
    key: "BJ-22",
    title: "厨房动线推演一版",
    projectId: "proj-demo-1",
    stageId: "model",
    stageLabel: "空间建模",
    priority: "medium",
    state: "todo",
    assignee: "阿凯深化",
    dueDate: "下周三",
  },
  {
    id: "t9",
    key: "XH-3",
    title: "约量房时间并确认决策人",
    projectId: "proj-demo-2",
    stageId: "requirements",
    stageLabel: "需求分析",
    priority: "medium",
    state: "todo",
    assignee: "林设计师",
    dueDate: "本周五",
  },
  {
    id: "t10",
    key: "XH-1",
    title: "结构评估纪要归档",
    projectId: "proj-demo-2",
    stageId: "requirements",
    stageLabel: "需求分析",
    priority: "low",
    state: "done",
    assignee: "林设计师",
    dueDate: "已完成",
  },
  {
    id: "t11",
    key: "XH-4",
    title: "历史改造照片归类",
    projectId: "proj-demo-2",
    stageId: "requirements",
    stageLabel: "需求分析",
    priority: "low",
    state: "in_progress",
    assignee: "结构顾问",
    dueDate: "本周",
  },
  {
    id: "t12",
    key: "XH-5",
    title: "客户预算区间确认",
    projectId: "proj-demo-2",
    stageId: "requirements",
    stageLabel: "需求分析",
    priority: "high",
    state: "todo",
    assignee: "林设计师",
    dueDate: "下周",
  },
  {
    id: "t13",
    key: "YQ-1",
    title: "电话回访线索意向",
    projectId: "proj-demo-3",
    stageId: null,
    stageLabel: "经营·线索",
    priority: "low",
    state: "in_progress",
    assignee: "林设计师",
    dueDate: "本周",
  },
  {
    id: "t14",
    key: "YQ-2",
    title: "发送工作室介绍与案例包",
    projectId: "proj-demo-3",
    stageId: null,
    stageLabel: "经营·线索",
    priority: "medium",
    state: "todo",
    assignee: "林设计师",
    dueDate: "明天",
  },
];

export const TASK_STATE_META: Record<
  ProjectTask["state"],
  { label: string; column: string }
> = {
  todo: { label: "待办", column: "待办" },
  in_progress: { label: "进行中", column: "进行中" },
  review: { label: "待确认", column: "待确认" },
  done: { label: "完成", column: "完成" },
};

export const PRIORITY_LABEL: Record<string, string> = {
  urgent: "紧急",
  high: "高",
  medium: "中",
  low: "低",
};

export function tasksForProject(projectId: string) {
  return PROJECT_TASKS.filter((t) => t.projectId === projectId);
}

/** 按设计阶段过滤；stageId=null 表示经营类未挂阶段 */
export function tasksForProjectStage(projectId: string, stageId: string | null | "all") {
  const all = tasksForProject(projectId);
  if (stageId === "all") return all;
  return all.filter((t) => t.stageId === stageId);
}


export function projectById(id: string) {
  return PM_PROJECTS.find((p) => p.id === id);
}

/** 经营节点（工作室仪表盘展示；不做 L2 第三级） */
export type BizNodeStatus = "done" | "current" | "todo";

export type BizNode = {
  id: string;
  label: string;
  status: BizNodeStatus;
};

/** 全工作室视角：各项目当前卡在哪个经营节点 */
export type ProjectBizSnapshot = {
  projectId: string;
  projectName: string;
  nodes: BizNode[];
};

const BIZ_NODE_LABELS = ["线索", "量房", "签约", "首期款", "方案确认", "中期款", "施工交底", "尾款/交付"] as const;

function nodesFromCurrent(currentIndex: number): BizNode[] {
  return BIZ_NODE_LABELS.map((label, i) => ({
    id: `n${i}`,
    label,
    status: (i < currentIndex ? "done" : i === currentIndex ? "current" : "todo") as BizNodeStatus,
  }));
}

export const PROJECT_BIZ_SNAPSHOTS: ProjectBizSnapshot[] = [
  {
    projectId: "proj-demo-1",
    projectName: "滨江壹号 · 新婚两居",
    nodes: nodesFromCurrent(3), // 首期款
  },
  {
    projectId: "proj-demo-2",
    projectName: "徐汇老宅改造",
    nodes: nodesFromCurrent(1), // 量房
  },
  {
    projectId: "proj-demo-3",
    projectName: "园区湖景平层",
    nodes: nodesFromCurrent(0), // 线索
  },
];
