/**
 * 构境 AI — 统一 Agent
 * - 停靠在 L2 大容器右侧（非 fixed 浮层）
 * - 画布页与其它业务页共用同一面板与对话
 * - 纯 React Context，不用 mobx observer（避免与 Context 更新打架导致按钮点了无响应）
 */
import { useState, type MouseEvent } from "react";
import { Clock, Plus, Sparkles, Trash2, X } from "@/icons";
import { cn } from "@plane/utils";
import { useFormscapeAi, type AiSessionArchive } from "./ai-context";
import "./formscape-ui.css";

const PROMPTS_DEFAULT = ["工作室项目概览", "看看采购清单", "下一步建议", "如何开始新项目"];
const PROMPTS_PROJECT = ["项目进度快照", "设计阶段状态", "家具采买清单", "下一步建议"];
const PROMPTS_CANVAS = [
  "画布上有什么",
  "生成：现代暖白客厅",
  "改图：更通透的采光",
  "变体",
];

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
          ? "bg-ai-subtle text-ai-primary"
          : "bg-layer-transparent text-secondary hover:bg-layer-transparent-hover hover:text-ai-primary"
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
    listSessions,
    loadSession,
    deleteSession,
  } = useFormscapeAi();
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<AiSessionArchive[]>([]);

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

  const openHistory = () => {
    setSessions(listSessions());
    setHistoryOpen(true);
  };

  const contextLabel = canvasActive
    ? `画布 · ${canvasProjectName ?? "—"}`
    : harness.projectId
      ? `项目 · ${harness.projectName ?? harness.projectId}`
      : "工作室 · 未绑定项目";

  return (
    <aside
      className={cn(
        "relative z-20 flex h-full shrink-0 flex-col overflow-hidden border-l border-ai-strong bg-surface-1 transition-[width] duration-200 ease-in-out",
        open ? "w-80 pointer-events-auto" : "w-0 border-l-0 pointer-events-none"
      )}
      aria-hidden={!open}
    >
      {open && (
        <div className="flex h-full w-80 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-subtle px-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-13 font-semibold text-primary">
                <Sparkles className="size-4 shrink-0 text-ai-primary" strokeWidth={1.75} />
                构境 AI
              </div>
              <span className="ml-5 inline-flex max-w-[13rem] items-center truncate rounded-full bg-ai-subtle px-1.5 py-px text-10 font-medium text-ai-secondary">
                {contextLabel}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              {(msgs.length > 0 || historyOpen) && (
                <button
                  type="button"
                  title="新对话"
                  onClick={() => {
                    clearMsgs();
                    setHistoryOpen(false);
                  }}
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-tertiary hover:bg-layer-transparent-hover"
                >
                  <Plus className="size-4" />
                </button>
              )}
              <button
                type="button"
                title="对话历史"
                onClick={() => (historyOpen ? setHistoryOpen(false) : openHistory())}
                className={cn(
                  "inline-flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-layer-transparent-hover",
                  historyOpen ? "bg-ai-subtle text-ai-primary" : "text-tertiary"
                )}
              >
                <Clock className="size-4" strokeWidth={1.75} />
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
            {historyOpen ? (
              <div className="space-y-2">
                <div className="text-11 font-medium text-secondary">历史对话 · 本机保存</div>
                {sessions.length === 0 ? (
                  <div className="rounded-md bg-surface-2 px-3 py-4 text-center text-11 text-tertiary">
                    还没有归档。点「新对话」会把当前会话收入历史。
                  </div>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-1 rounded-lg border border-subtle bg-surface-1 p-2"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 cursor-pointer text-left"
                        onClick={() => {
                          if (loadSession(s.id)) setHistoryOpen(false);
                        }}
                      >
                        <div className="truncate text-12 font-medium text-primary">{s.title}</div>
                        <div className="mt-0.5 text-10 text-tertiary tabular-nums">
                          {new Date(s.updatedAt).toLocaleString("zh-CN", {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          · {s.msgs.length} 条
                        </div>
                      </button>
                      <button
                        type="button"
                        title="删除"
                        className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-tertiary hover:bg-danger-subtle hover:text-danger-primary"
                        onClick={() => {
                          deleteSession(s.id);
                          setSessions(listSessions());
                        }}
                      >
                        <Trash2 className="size-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  ))
                )}
                <button
                  type="button"
                  className="w-full cursor-pointer rounded-md border border-subtle py-1.5 text-11 text-secondary hover:bg-surface-2"
                  onClick={() => setHistoryOpen(false)}
                >
                  返回当前对话
                </button>
              </div>
            ) : (
              <>
            {msgs.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-md bg-surface-2 px-3 py-2 text-11 leading-relaxed text-secondary">
                  {canvasActive
                    ? "画布 Agent（非全局）：可落图、对选中图改图/变体。试快捷建议。"
                    : harness.projectId
                      ? "项目制 harness：可查双轴进度、设计阶段、采购清单；经营写操作需要明确二次确认。"
                      : "项目制 harness。进入项目或画布后能力更完整；全局 Agent 尚未接入。对话会自动保存在本机。"}
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
                    isUser ? "ml-auto bg-ai-primary text-on-color" : "bg-surface-2 text-secondary"
                  )}
                >
                  {m.text}
                  {!isUser && m.role === "agent" && m.toolTrace && m.toolTrace.length > 0 && (
                    <div className="mt-2 border-t border-subtle/60 pt-1.5 text-10 text-placeholder">
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
                className="cursor-pointer self-start rounded-full border border-ai-subtle bg-surface-1 px-2.5 py-1.5 text-11 font-medium text-ai-primary hover:bg-ai-subtle"
              >
                放到画布
              </button>
            )}
              </>
            )}
          </div>

          <div className="shrink-0 border-t border-subtle p-3">
            {busy && (
              <div className="fs-progress-indeterminate mb-2 h-1 w-full rounded-full bg-surface-2">
                <i />
              </div>
            )}
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
                className="min-w-0 flex-1 rounded-md border border-subtle bg-surface-1 px-2.5 py-2 text-13 text-primary placeholder:text-placeholder outline-none focus:border-ai-strong"
                placeholder={
                  canvasActive ? "生成：… / 改图：… / 画布上有什么" : "项目问题… harness 调工具"
                }
              />
              <button
                type="button"
                disabled={!input.trim() || busy}
                onClick={submit}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-11 font-medium transition-all duration-150 ease-out",
                  !input.trim() || busy
                    ? "cursor-not-allowed bg-surface-2 text-tertiary"
                    : "cursor-pointer bg-ai-primary text-on-color hover:-translate-y-px hover:brightness-105"
                )}
              >
                <Sparkles className="size-3" strokeWidth={1.75} />
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
