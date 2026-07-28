/**
 * 统一 Project 数据模型（真源层）——差距清单 §1.2 P1「消灭各页假数」。
 *
 * 三个真源在此汇合：
 * - 项目目录：projects-store（SQLite 项目元数据）
 * - 进度真源：project-progress-store（经营节点 / 设计七段 / 设计费，localStorage 可写）
 * - 任务真源：tasks-store（含草稿，localStorage 可写）
 *
 * 仪表盘 KPI、项目卡（风险/任务计数/设计费）一律从这里派生；
 * pm-mock 里的静态 risk/openTasks/overdueTasks/progress/feeCollectedWan 字段不再被消费。
 */
import type { PmProject } from "./pm-mock";
import {
  getBizNodesView,
  getDesignFeeProgress,
  getDesignStageProgress,
} from "./project-progress-store";
import { listDrafts, listTasks, listTasksForProject, toDateKey } from "./tasks-store";
import { STAGES } from "./types";
import { listProjects } from "./projects-store";

export type ProjectRisk = "正常" | "关注" | "延期";

/* ---------- 任务统计（单项目） ---------- */

export type ProjectTaskStats = { open: number; overdue: number };

export function getProjectTaskStats(projectId: string, now = new Date()): ProjectTaskStats {
  const today = toDateKey(now);
  const open = listTasksForProject(projectId).filter((t) => t.state !== "done");
  const overdue = open.filter((t) => t.dueDate != null && t.dueDate <= today);
  return { open: open.length, overdue: overdue.length };
}

/** 风险派生规则：有逾期任务 → 延期；有 stale 过期阶段 → 关注；否则正常 */
export function deriveProjectRisk(projectId: string, now = new Date()): ProjectRisk {
  if (getProjectTaskStats(projectId, now).overdue > 0) return "延期";
  if (getDesignStageProgress(projectId).staleCount > 0) return "关注";
  return "正常";
}

/* ---------- 项目卡模型 ---------- */

export type ProjectCardModel = {
  projectId: string;
  name: string;
  identifier: string;
  city: string;
  houseType: string;
  clientName: string;
  members: string[];
  /** 设计轴 */
  designPct: number;
  confirmedStages: number;
  stageTotal: number;
  focusStageLabel: string;
  /** 经营轴 */
  bizLabel: string;
  feeCollectedWan: number;
  feeTotalWan: number;
  /** 任务与风险 */
  openTasks: number;
  overdueTasks: number;
  risk: ProjectRisk;
};

export function getProjectCardModel(p: PmProject, now = new Date()): ProjectCardModel {
  const design = getDesignStageProgress(p.id);
  const biz = getBizNodesView(p.id);
  const fee = getDesignFeeProgress(p.id);
  const tasks = getProjectTaskStats(p.id, now);
  const current = biz.find((n) => n.status === "current");
  return {
    projectId: p.id,
    name: p.name,
    identifier: p.identifier,
    city: p.city,
    houseType: p.houseType,
    clientName: p.clientName,
    members: p.members,
    designPct: design.pct,
    confirmedStages: design.confirmed,
    stageTotal: design.total,
    focusStageLabel: STAGES.find((s) => s.id === design.focusStage)?.label ?? "—",
    bizLabel: current?.label ?? "已交付",
    feeCollectedWan: fee.collectedWan,
    feeTotalWan: fee.designFeeWan,
    openTasks: tasks.open,
    overdueTasks: tasks.overdue,
    risk: deriveProjectRisk(p.id, now),
  };
}

export function getStudioProjectCards(now = new Date()): ProjectCardModel[] {
  return listProjects().map((p) => getProjectCardModel(p, now));
}

/* ---------- 工作室 KPI ---------- */

export type StudioKpi = {
  activeProjects: number;
  myOpenTasks: number;
  urgent: number;
  drafts: number;
  /** 设计费待收合计（万），随经营节点推进自动减少 */
  feePendingWan: number;
};

export function getStudioKpi(now = new Date()): StudioKpi {
  const today = toDateKey(now);
  const open = listTasks().filter((t) => t.state !== "done");
  const urgent = open.filter(
    (t) => t.priority === "urgent" || t.priority === "high" || (t.dueDate != null && t.dueDate <= today)
  );
  const feePendingWan = Number(
    listProjects().reduce((sum, p) => sum + getDesignFeeProgress(p.id).pendingWan, 0).toFixed(1)
  );
  return {
    activeProjects: listProjects().length,
    myOpenTasks: open.length,
    urgent: urgent.length,
    drafts: listDrafts().length,
    feePendingWan,
  };
}
