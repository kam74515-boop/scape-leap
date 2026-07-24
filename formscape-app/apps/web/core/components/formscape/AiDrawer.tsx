/**
 * 构境 AI — 统一 Agent
 * - 停靠在 L2 大容器右侧（非 fixed 浮层）
 * - 画布页与其它业务页共用同一面板与对话
 * - 纯 React Context，不用 mobx observer（避免与 Context 更新打架导致按钮点了无响应）
 */
import { useState, type MouseEvent } from "react";
import { Clock, Plus, Sparkles, X } from "@/icons";
import { cn } from "@plane/utils";
import { useFormscapeAi } from "./ai-context";

const PROMPTS_DEFAULT = ["项目进度怎么样", "看看采购清单", "下一步建议", "推进经营节点"];
const PROMPTS_PROJECT = ["项目进度快照", "设计阶段状态", "家具采买清单", "下一步建议"];
const PROMPTS_CANVAS = ["分析当前意向板", "提炼色板关键词", "给客厅出 3 个布局建议", "生成汇报口播稿"];

/** 顶栏右侧 AI 按钮 — 展开/收起同一入口 */
export function FormscapeAiHeaderButton() {
  const { open, toggle } = useFormscapeAi();

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative z-20 inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-11 font-medium transition-colors",
        open
          ? "bg-accent-subtle text-accent-primary"
          : "bg-layer-transparent text-secondary hover:bg-layer-transparent-hover"
      )}
      aria-label={open ? "收起 AI" : "打开 AI"}
      aria-pressed={open}
    >
      <Sparkles className="size-3.5" />
      <span className="hidden sm:inline">AI</span>
    </button>
  );
}

/** L2 壳右侧停靠面板 — 项目制 Harness Agent */
export function FormscapeAiPanel() {
  const {
    open,
    setOpen,
    canvasActive,
    canvasProjectName,
    harness,
    msgs,
    busy,
    send,
    clearMsgs,
    placeToCanvas,
  } = useFormscapeAi();
  const [input, setInput] = useState("");

  const prompts = canvasActive
    ? PROMPTS_CANVAS
    : harness.projectId
      ? PROMPTS_PROJECT
      : PROMPTS_DEFAULT;
  const hasAgentReply = msgs.some((m) => m.role === "agent");

  const submit = () => {
    if (!input.trim() || busy) return;
    send(input);
    setInput("");
  };

  const contextLabel = canvasActive
    ? `画布 · ${canvasProjectName ?? "—"}`
    : harness.projectId
      ? `项目 · ${harness.projectName ?? harness.projectId}`
      : "工作室 · 未绑定项目";

  return (
    <aside
      className={cn(
        "relative z-20 flex h-full shrink-0 flex-col overflow-hidden border-l border-subtle bg-surface-1 transition-[width] duration-200 ease-in-out",
        open ? "w-80 pointer-events-auto" : "w-0 border-l-0 pointer-events-none"
      )}
      aria-hidden={!open}
    >
      {open && (
        <div className="flex h-full w-80 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-subtle px-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-13 font-semibold text-primary">
                <Sparkles className="size-4 shrink-0 text-accent-primary" />
                构境 AI
              </div>
              <div className="truncate pl-5 text-[10px] text-tertiary">{contextLabel}</div>
            </div>
            <div className="flex items-center gap-0.5">
              {msgs.length > 0 && (
                <button
                  type="button"
                  title="新对话"
                  onClick={clearMsgs}
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-tertiary hover:bg-layer-transparent-hover"
                >
                  <Plus className="size-4" />
                </button>
              )}
              <button
                type="button"
                title="历史（即将上线）"
                disabled
                className="inline-flex size-8 items-center justify-center rounded-md text-tertiary opacity-40"
              >
                <Clock className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-tertiary hover:bg-layer-transparent-hover"
                aria-label="关闭 AI"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 text-13">
            {msgs.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-md bg-surface-2 px-3 py-2 text-11 leading-relaxed text-secondary">
                  {canvasActive
                    ? "项目制 harness · 画布上下文。产出可放到节点。"
                    : harness.projectId
                      ? "项目制 harness：可查双轴进度、设计阶段、采购清单（与生态库同源），并推进经营节点。"
                      : "项目制 harness。进入项目后可调用项目工具；当前为工作室级。"}
                </div>
                <div className="text-11 font-medium text-placeholder">快捷建议</div>
                <div className="grid gap-1.5">
                  {prompts.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="block w-full cursor-pointer rounded-md border border-subtle px-3 py-2 text-left text-13 text-secondary hover:bg-surface-2"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m) => {
              if (m.role === "thinking") {
                return (
                  <div key={m.id} className="max-w-[95%] rounded-md bg-surface-2 px-2.5 py-2 text-11 text-tertiary">
                    harness 调用工具中…
                  </div>
                );
              }
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[95%] rounded-md px-2.5 py-2 text-11 leading-relaxed whitespace-pre-wrap",
                    isUser ? "ml-auto bg-accent-primary text-on-color" : "bg-surface-2 text-secondary"
                  )}
                >
                  {m.text}
                  {!isUser && m.role === "agent" && m.toolTrace && m.toolTrace.length > 0 && (
                    <div className="mt-2 border-t border-subtle/60 pt-1.5 text-[10px] text-placeholder">
                      tools: {m.toolTrace.map((t) => t.tool).join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}

            {canvasActive && hasAgentReply && !busy && (
              <button
                type="button"
                onClick={() => placeToCanvas()}
                className="cursor-pointer self-start rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-11 font-medium text-accent-primary hover:bg-surface-2"
              >
                放到画布
              </button>
            )}
          </div>

          <div className="shrink-0 border-t border-subtle p-3">
            <div className="flex gap-1.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                className="min-w-0 flex-1 rounded-md border border-subtle bg-surface-1 px-2.5 py-2 text-13 text-primary placeholder:text-placeholder outline-none focus:border-accent-primary"
                placeholder="项目问题… harness 调工具"
              />
              <button
                type="button"
                disabled={!input.trim() || busy}
                onClick={submit}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1.5 text-11 font-medium",
                  !input.trim() || busy
                    ? "cursor-not-allowed bg-surface-2 text-tertiary"
                    : "cursor-pointer bg-accent-primary text-on-color hover:opacity-90"
                )}
              >
                发送
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

/** @deprecated 使用 FormscapeAiPanel + FormscapeAiHeaderButton */
export function FormscapeAiFab() {
  return null;
}
