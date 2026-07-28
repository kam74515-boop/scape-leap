import { beforeEach, describe, expect, test } from "vitest";
import { flushFsWrites, resetFsDataForTests } from "../fs-data-client";
import {
  createProject,
  getProjectById,
  isProjectIdentifierTaken,
  listProjects,
  updateProject,
} from "../projects-store";
import { initializeProjectProgress, getProjectProgress } from "../project-progress-store";

beforeEach(async () => {
  await resetFsDataForTests();
});

describe("统一项目目录", () => {
  test("新建项目进入目录、可更新，并初始化双轴进度", async () => {
    const before = listProjects().length;
    const project = createProject({
      name: "测试新家项目",
      identifier: "TS",
      clientName: "测试客户",
      city: "南京",
      houseType: "平层 · 120㎡",
      budgetWan: 52,
      designFeeWan: 4.6,
      owner: "林设计师",
      members: ["周深化"],
    });
    initializeProjectProgress(project.id, project.designFeeWan);

    expect(listProjects()).toHaveLength(before + 1);
    expect(getProjectById(project.id)?.clientName).toBe("测试客户");
    expect(isProjectIdentifierTaken("ts")).toBe(true);
    expect(getProjectProgress(project.id)).toMatchObject({
      focusStage: "requirements",
      bizDoneMax: -1,
      designFeeWan: 4.6,
    });

    updateProject(project.id, { city: "苏州" });
    expect(getProjectById(project.id)?.city).toBe("苏州");

    await flushFsWrites();
    const base = (globalThis as { __FS_API_BASE?: string }).__FS_API_BASE!;
    const projects = (await (await fetch(`${base}/api/fs/projects`)).json()) as { id: string }[];
    expect(projects.some((item) => item.id === project.id)).toBe(true);
  });
});
