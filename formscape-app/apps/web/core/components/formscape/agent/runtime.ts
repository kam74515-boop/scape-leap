/**
 * Harness runtime — Demo 交互逻辑优先
 * 画布页：意图解析 → 调用画布 tools；全局 Agent 未做
 */
import { matchSkill } from "./skills";
import { runTool } from "./tools";
import type { HarnessTurnResult, ProjectHarnessContext, ToolTrace } from "./types";
import { matchCanvasSkillFromText } from "../canvas/skills/match-skill";
import { pickMockResultSrcs } from "../canvas/skills/mock-skill-assets";
import { SKILLS_BY_ID } from "../canvas/skills/registry";

type CanvasIntent =
  | { kind: "snapshot" }
  | { kind: "place_gen"; prompt: string; skillId?: string }
  | { kind: "edit"; instruction: string }
  | { kind: "place_image"; title: string; skillId?: string }
  | { kind: "run_skill"; skillId: string; prompt?: string }
  | { kind: "chat" };

function parseCanvasIntent(text: string): CanvasIntent {
  const t = text.trim();
  const lower = t.toLowerCase();

  if (
    /画布上有什么|有哪些节点|快照|选中了/.test(t) ||
    lower.includes("snapshot")
  ) {
    return { kind: "snapshot" };
  }

  // 技能：空房设计 / 用白模渲染 …
  const skillCmd = t.match(/^(?:技能|skill)[：:\s]+(.+)$/i);
  if (skillCmd?.[1]) {
    const skill = matchCanvasSkillFromText(skillCmd[1]);
    if (skill) return { kind: "run_skill", skillId: skill.id, prompt: skillCmd[1] };
  }

  const editM = t.match(/^(?:改图|修改|变体|延展|再生成|风格延展)[：:\s]*(.*)$/);
  if (editM) {
    const rest = editM[1]?.trim();
    if (t.startsWith("变体") || t.includes("变体")) {
      return { kind: "edit", instruction: rest || "变体" };
    }
    if (t.includes("延展")) {
      return { kind: "edit", instruction: rest ? `风格延展：${rest}` : "风格延展" };
    }
    if (t.includes("再生成")) {
      return { kind: "edit", instruction: rest || "再生成" };
    }
    return { kind: "edit", instruction: rest || "风格延展" };
  }

  const genM = t.match(/^(?:生成|落图|出图)[：:\s]+(.+)$/);
  if (genM?.[1]) {
    const prompt = genM[1].trim();
    const skill = matchCanvasSkillFromText(prompt);
    return { kind: "place_gen", prompt, skillId: skill?.id };
  }
  if (/^(?:生成|落图|出图)$/.test(t)) {
    return { kind: "place_gen", prompt: "空间效果图", skillId: "unfurnished-space-generation" };
  }

  const placeM = t.match(/^(?:放到画布|建议稿)[：:\s]*(.*)$/);
  if (placeM) {
    const title = placeM[1]?.trim() || "AI 建议稿";
    const skill = matchCanvasSkillFromText(title);
    return { kind: "place_image", title, skillId: skill?.id };
  }

  // 口语：「帮我生成一个…」
  const helpGen = t.match(/(?:帮我|帮忙|请)?生成(?:一张|一个)?[：:\s]*(.+)/);
  if (helpGen?.[1] && helpGen[1].length < 80) {
    const prompt = helpGen[1].trim();
    const skill = matchCanvasSkillFromText(prompt);
    return { kind: "place_gen", prompt, skillId: skill?.id };
  }

  // 直接说技能名：「空房设计」「材质替换」
  const directSkill = matchCanvasSkillFromText(t);
  if (directSkill && (t === directSkill.name || t.length <= 12)) {
    return { kind: "run_skill", skillId: directSkill.id, prompt: directSkill.name };
  }

  return { kind: "chat" };
}

export async function runHarnessTurn(
  ctx: ProjectHarnessContext,
  userText: string
): Promise<HarnessTurnResult> {
  const skill = matchSkill(userText, ctx.canvasActive);
  const toolTrace: ToolTrace[] = [];
  const text = userText.trim();

  // —— 画布 Agent：按意图精确调用 ——
  if (ctx.canvasActive) {
    const intent = parseCanvasIntent(text);
    const snap = await runTool("canvas_snapshot", ctx, {});
    toolTrace.push({ tool: "canvas_snapshot", args: {}, result: snap });

    if (intent.kind === "place_gen" || intent.kind === "run_skill") {
      const skillId =
        intent.kind === "run_skill" ? intent.skillId : intent.skillId;
      const skill = skillId ? SKILLS_BY_ID[skillId] : undefined;
      const prompt =
        intent.kind === "run_skill"
          ? intent.prompt || skill?.name || "技能生成"
          : intent.prompt;
      const r = await runTool("canvas_place_gen", {
        ...ctx,
      }, {
        prompt,
        skillId,
        count: skill?.defaultCount ?? 1,
      });
      toolTrace.push({
        tool: "canvas_place_gen",
        args: { prompt, skillId },
        result: r,
      });
    } else if (intent.kind === "edit") {
      const r = await runTool("canvas_edit_selected", ctx, { instruction: intent.instruction });
      toolTrace.push({
        tool: "canvas_edit_selected",
        args: { instruction: intent.instruction },
        result: r,
      });
    } else if (intent.kind === "place_image") {
      const srcs = pickMockResultSrcs({ skillId: intent.skillId, count: 1 });
      const r = await runTool("canvas_place_image", ctx, {
        title: intent.title,
        src: srcs[0],
        colors: intent.skillId ? SKILLS_BY_ID[intent.skillId]?.colors : undefined,
      });
      toolTrace.push({
        tool: "canvas_place_image",
        args: { title: intent.title, skillId: intent.skillId },
        result: r,
      });
    }

    // 经营意图仍可叠加
    if (skill.id === "project_ops" || skill.id === "furniture_purchase") {
      for (const toolName of skill.tools) {
        if (toolName.startsWith("canvas_")) continue;
        if (!ctx.projectId && toolName !== "suggest_next_actions") continue;
        const result = await runTool(toolName, ctx, {});
        toolTrace.push({ tool: toolName, args: {}, result });
      }
    }

    const lines: string[] = [];
    lines.push(`【画布 Agent】${skill.systemHint}`);
    lines.push(`画布：${ctx.projectName ?? "意向画布"}`);
    lines.push("");
    for (const tr of toolTrace) {
      lines.push(`${tr.result.ok ? "✓" : "✗"} \`${tr.tool}\`：${tr.result.summary}`);
    }
    if (intent.kind === "chat") {
      lines.push("");
      lines.push(
        "可以说：\n· 生成：空房设计 / 暖白客厅\n· 技能：白模渲染\n· 改图：更通透（先选中图）\n· 变体 / 延展\n· 画布上有什么\n· 直接发技能名：材质替换"
      );
    }
    lines.push("");
    lines.push("（Demo 交互 · 非正式生图 API · 全局 Agent 未接入）");
    return { text: lines.join("\n"), skillId: skill.id, toolTrace };
  }

  // —— 非画布：项目 harness ——
  for (const toolName of skill.tools) {
    if (toolName.startsWith("canvas_")) continue;
    const result = await runTool(toolName, ctx, {});
    toolTrace.push({ tool: toolName, args: {}, result });
  }

  const lines: string[] = [];
  lines.push(`【${skill.label}】${skill.systemHint}`);
  if (!ctx.projectId) {
    lines.push("");
    lines.push("未绑定项目。进入项目或意向画布可获得更多能力。");
  } else {
    lines.push("");
    lines.push(`项目：${ctx.projectName ?? ctx.projectId}`);
    if (ctx.focusStage) lines.push(`焦点阶段：${ctx.focusStage}`);
  }
  lines.push("");
  lines.push(`关于「${text}」：`);
  for (const tr of toolTrace) {
    lines.push(`${tr.result.ok ? "✓" : "✗"} \`${tr.tool}\`：${tr.result.summary}`);
  }
  lines.push("");
  lines.push("（Demo harness · 全局 Agent 未做）");

  return { text: lines.join("\n"), skillId: skill.id, toolTrace };
}
