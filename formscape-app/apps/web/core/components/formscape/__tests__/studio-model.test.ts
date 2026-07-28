/**
 * 统一 Project 数据模型（studio-model）真源测试——差距清单 §1.2「消灭各页假数」。
 * 证明：修改底层 store（tasks / progress / drafts）后，派生值（KPI/风险/设计费）随之变化。
 */
import { beforeEach, describe, expect, test } from "vitest";
import {
  deriveProjectRisk,
  getProjectCardModel,
  getProjectTaskStats,
  getStudioKpi,
} from "../studio-model";
import {
  addTask,
  addDaysKey,
  listDrafts,
  listTasksForProject,
  publishDraftAsTask,
  removeTask,
  toDateKey,
  updateTask,
} from "../tasks-store";
import {
  advanceBizNode,
  confirmStage,
  getDesignFeeProgress,
  getProjectProgress,
  reopenStage,
} from "../project-progress-store";
import { PM_PROJECTS } from "../pm-mock";
import { resetFsDataForTests } from "../fs-data-client";

const P1 = "proj-demo-1";

/** 把某项目所有未完成任务的截止日推到 7 天后：风险基线归位（种子任务里有「今天」到期项） */
function clearOverdue(projectId: string) {
  const today = toDateKey(new Date());
  const future = addDaysKey(new Date(), 7);
  for (const t of listTasksForProject(projectId)) {
    if (t.state !== "done" && t.dueDate != null && t.dueDate <= today) {
      updateTask(t.id, { dueDate: future });
    }
  }
}

beforeEach(async () => {
  await resetFsDataForTests();
});

describe("风险派生（任务逾期 / 阶段过期 → 风险变化）", () => {
  test("新增昨天到期的任务 → 延期；删除后回落", () => {
    clearOverdue(P1);
    expect(getProjectTaskStats(P1).overdue).toBe(0);
    expect(deriveProjectRisk(P1)).not.toBe("延期");
    const t = addTask({
      projectId: P1,
      title: "逾期测试任务",
      stageId: null,
      priority: "medium",
      assignee: "测试",
      dueDate: addDaysKey(new Date(), -1),
    });
    expect(getProjectTaskStats(P1).overdue).toBe(1);
    expect(deriveProjectRisk(P1)).toBe("延期");
    removeTask(t.id);
    expect(deriveProjectRisk(P1)).not.toBe("延期");
  });

  test("回跳已确认阶段 → 下游确认阶段过期 → 关注；逐一确认后消除", () => {
    clearOverdue(P1);
    // proj-demo-1 种子：requirements 已确认、style 进行中；先确认 style/model 造出下游
    confirmStage(P1, "style");
    confirmStage(P1, "model");
    reopenStage(P1, "style");
    expect(getProjectProgress(P1).staleStages.length).toBeGreaterThan(0);
    expect(deriveProjectRisk(P1)).toBe("关注");
    // 把 stale 阶段逐一确认，stale 清空
    for (const s of [...getProjectProgress(P1).staleStages]) confirmStage(P1, s);
    expect(getProjectProgress(P1).staleStages.length).toBe(0);
    expect(deriveProjectRisk(P1)).toBe("正常");
  });
});

describe("设计费真源（经营节点推进 → 待收减少）", () => {
  test("推进到下一个带费节点后 getStudioKpi().feePendingWan 随之减少", () => {
    // proj-demo-1 种子 bizDoneMax=3（首期款 0.4）；feeShare 分布：fee1=0.4 / fee2=0.3 / final=0.3
    const feeBefore = getDesignFeeProgress(P1);
    const kpiBefore = getStudioKpi().feePendingWan;
    advanceBizNode(P1); // 3→4（方案确认，share 0）
    advanceBizNode(P1); // 4→5（中期款，share 0.3）
    const feeAfter = getDesignFeeProgress(P1);
    expect(feeAfter.collectedWan).toBeGreaterThan(feeBefore.collectedWan);
    expect(getStudioKpi().feePendingWan).toBeLessThan(kpiBefore);
  });
});

describe("KPI 真源（草稿发布 → drafts 减少、open 增加）", () => {
  test("publishDraftAsTask 后 drafts-1 且 myOpenTasks+1", () => {
    const k0 = getStudioKpi();
    expect(k0.drafts).toBeGreaterThan(0);
    const d = listDrafts()[0];
    publishDraftAsTask(d);
    const k1 = getStudioKpi();
    expect(k1.drafts).toBe(k0.drafts - 1);
    expect(k1.myOpenTasks).toBe(k0.myOpenTasks + 1);
  });

  test("urgent 统计：新增今天到期任务 → urgent+1", () => {
    const k0 = getStudioKpi();
    addTask({
      projectId: P1,
      title: "今天截止测试",
      stageId: null,
      priority: "low",
      assignee: "测试",
      dueDate: addDaysKey(new Date(), 0),
    });
    expect(getStudioKpi().urgent).toBe(k0.urgent + 1);
  });
});

describe("项目卡模型（同源一致性）", () => {
  test("card 的 fee/任务数与 progress-store / tasks-store 派生一致", () => {
    const p = PM_PROJECTS.find((x) => x.id === P1)!;
    const card = getProjectCardModel(p);
    const fee = getDesignFeeProgress(P1);
    expect(card.feeCollectedWan).toBe(fee.collectedWan);
    expect(card.feeTotalWan).toBe(fee.designFeeWan);
    expect(card.openTasks).toBe(getProjectTaskStats(P1).open);
    expect(card.overdueTasks).toBe(getProjectTaskStats(P1).overdue);
    expect(card.stageTotal).toBe(7);
  });
});
