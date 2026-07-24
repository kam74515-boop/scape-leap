/**
 * Harness runtime — 对标 grok-build shell 的「一轮 turn」
 * Demo：规则路由 skill → 顺序调用 tools → 合成回复（不联网）
 * 后续可替换为 LLM + tool calling，工具表保持不变
 */
import { matchSkill } from "./skills";
import { runTool } from "./tools";
import type { HarnessTurnResult, ProjectHarnessContext, ToolTrace } from "./types";

export async function runHarnessTurn(
  ctx: ProjectHarnessContext,
  userText: string
): Promise<HarnessTurnResult> {
  const skill = matchSkill(userText);
  const toolTrace: ToolTrace[] = [];

  // 按 skill 绑定工具依次执行（Demo 无参数）
  for (const toolName of skill.tools) {
    const result = await runTool(toolName, ctx, {});
    toolTrace.push({ tool: toolName, args: {}, result });
    // 写工具成功后若是 advance，后面的 snapshot 会看到新状态——工具内已实时读 store
  }

  const lines: string[] = [];
  lines.push(`【${skill.label}】${skill.systemHint}`);

  if (!ctx.projectId) {
    lines.push("");
    lines.push(
      "当前未绑定项目上下文。请打开某个项目后再问进度/采购；或先从工作室仪表盘进入项目。"
    );
  } else {
    lines.push("");
    lines.push(`项目上下文：${ctx.projectName ?? ctx.projectId}`);
    if (ctx.focusStage) lines.push(`焦点阶段：${ctx.focusStage}`);
  }

  lines.push("");
  lines.push(`关于「${userText.trim()}」——工具结果：`);
  for (const tr of toolTrace) {
    const mark = tr.result.ok ? "✓" : "✗";
    lines.push(`${mark} \`${tr.tool}\`：${tr.result.summary}`);
  }

  lines.push("");
  lines.push(
    "（Demo harness：本地工具 + 规则 skill。底层语义对齐 refs/grok-build：tools / skills / project workspace，后续可换真模型。）"
  );

  return {
    text: lines.join("\n"),
    skillId: skill.id,
    toolTrace,
  };
}
