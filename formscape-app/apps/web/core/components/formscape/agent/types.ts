/**
 * 构境项目制 Agent Harness 类型
 *
 * 对标 refs/grok-build（Apache-2.0）的分层概念：
 * - workspace / session  → ProjectHarnessContext（项目为边界）
 * - tools                → HarnessTool（项目域工具）
 * - skills               → HarnessSkill（阶段/经营技能包）
 * - shell runtime        → runHarnessTurn
 * - subagents            → 后续按角色拆（经营 / 设计 / 采购）
 *
 * 不嵌入 Rust TUI；在 Web Studio 内实现同源 harness 语义。
 */

import type { StageId } from "../types";

/** 项目 harness 工作区 — 对应 grok-build workspace 的「项目切片」 */
export type ProjectHarnessContext = {
  workspaceSlug: string;
  projectId: string | null;
  projectName: string | null;
  /** 当前设计阶段焦点 */
  focusStage: StageId | null;
  /** 画布是否激活 */
  canvasActive: boolean;
  /** 会话 id（前端-only） */
  sessionId: string;
};

export type ToolResult = {
  ok: boolean;
  /** 给模型/UI 的摘要 */
  summary: string;
  /** 结构化数据（可选） */
  data?: unknown;
};

export type HarnessTool = {
  name: string;
  description: string;
  /** 仅在有 projectId 时可用 */
  requiresProject?: boolean;
  /** 会改变业务数据；runtime 必须在用户明确确认后才可执行 */
  requiresConfirmation?: boolean;
  run: (ctx: ProjectHarnessContext, args: Record<string, unknown>) => ToolResult | Promise<ToolResult>;
};

export type HarnessSkill = {
  id: string;
  label: string;
  description: string;
  /** 触发关键词（Demo 路由） */
  triggers: string[];
  /** 关联工具名 */
  tools: string[];
  /** 系统提示片段 */
  systemHint: string;
};

export type HarnessMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "agent"; text: string; toolTrace?: ToolTrace[] }
  | { id: string; role: "thinking" };

export type ToolTrace = {
  tool: string;
  args: Record<string, unknown>;
  result: ToolResult;
};

export type HarnessTurnResult = {
  text: string;
  skillId: string | null;
  toolTrace: ToolTrace[];
};
