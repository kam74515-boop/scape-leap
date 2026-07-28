import { beforeEach, describe, expect, test } from "vitest";
import { runHarnessTurn } from "../agent/runtime";
import { runTool } from "../agent/tools";
import type { ProjectHarnessContext } from "../agent/types";
import { getProjectProgress } from "../project-progress-store";
import { resetFsDataForTests } from "../fs-data-client";

const PROJECT_ID = "proj-demo-1";
const context: ProjectHarnessContext = {
  workspaceSlug: "formscape",
  projectId: PROJECT_ID,
  projectName: "滨江壹号 · 新婚两居",
  focusStage: "style",
  canvasActive: false,
  sessionId: "agent-safety-test",
};

beforeEach(async () => {
  await resetFsDataForTests();
});

describe("Agent 经营写操作安全闸门", () => {
  test("项目进度查询只执行只读工具，不推进经营节点", async () => {
    const before = getProjectProgress(PROJECT_ID).bizDoneMax;
    const result = await runHarnessTurn(context, "项目进度快照");

    expect(result.toolTrace.map((trace) => trace.tool)).toEqual([
      "get_project_snapshot",
      "suggest_next_actions",
    ]);
    expect(getProjectProgress(PROJECT_ID).bizDoneMax).toBe(before);
  });

  test("推进请求先返回确认提示，不立即写入", async () => {
    const before = getProjectProgress(PROJECT_ID).bizDoneMax;
    const result = await runHarnessTurn(context, "推进经营节点");

    expect(result.text).toContain("确认推进经营节点");
    expect(result.toolTrace.some((trace) => trace.tool === "advance_biz_node")).toBe(false);
    expect(getProjectProgress(PROJECT_ID).bizDoneMax).toBe(before);
  });

  test("写工具默认拒绝执行，只有明确确认后推进一次", async () => {
    const before = getProjectProgress(PROJECT_ID).bizDoneMax;
    const blocked = await runTool("advance_biz_node", context);
    expect(blocked.ok).toBe(false);
    expect(getProjectProgress(PROJECT_ID).bizDoneMax).toBe(before);

    const result = await runHarnessTurn(context, "确认推进经营节点");
    expect(result.toolTrace.at(-1)?.tool).toBe("advance_biz_node");
    expect(result.toolTrace.at(-1)?.result.ok).toBe(true);
    expect(getProjectProgress(PROJECT_ID).bizDoneMax).toBe(before + 1);
  });
});
