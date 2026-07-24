/**
 * 我的工作 = 分配给我的跨项目任务
 * 顶栏由 profile layout AppHeader 负责，页内不再套 FsPageHeader
 */
import { Link } from "react-router";
import { useMemo, useState } from "react";
import { cn } from "@plane/utils";
import { MY_ASSIGNMENTS, PRIORITY_LABEL, TASK_STATE_META } from "./pm-mock";
import { FsMuted, FsTag } from "./ui";

type Props = { workspaceSlug: string };

const FILTERS = ["全部", "进行中", "待办", "待确认", "紧急", "已完成"] as const;

export function FormscapeMyWorkPage({ workspaceSlug }: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("全部");
  const list = useMemo(() => {
    return MY_ASSIGNMENTS.filter((a) => {
      if (filter === "进行中") return a.state === "in_progress";
      if (filter === "待办") return a.state === "todo";
      if (filter === "待确认") return a.state === "review";
      if (filter === "紧急") return a.priority === "urgent" || a.priority === "high";
      if (filter === "已完成") return a.state === "done";
      return true;
    });
  }, [filter]);

  const openCount = MY_ASSIGNMENTS.filter((a) => a.state !== "done").length;

  return (
    <div className="h-full overflow-y-auto bg-surface-1 px-3 py-4 md:px-4">
      <div className="mx-auto w-full max-w-[900px] space-y-3">
        <div className="rounded-lg border border-accent-primary/20 bg-accent-subtle/40 px-3 py-2 text-11 text-secondary">
          与 Plane「个人资料」不同：这里是<strong className="text-primary">工作内容分配</strong>
          ——跨项目看你要做的事 · 未完成 {openCount} 项
        </div>

        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-2.5 py-1 text-11 font-medium transition-colors",
                filter === f
                  ? "bg-accent-primary text-on-color"
                  : "bg-surface-2 text-secondary hover:bg-layer-transparent-hover"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <FsMuted>共 {list.length} 项 · 点击进入对应项目任务看板</FsMuted>

        <div className="space-y-2">
          {list.map((a) => (
            <Link
              key={a.id}
              to={`/${workspaceSlug}/projects/${a.projectId}/issues`}
              className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface-1 px-3 py-3 shadow-sm transition-colors hover:border-accent-primary/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-11 text-placeholder">{a.key}</span>
                  <span className="truncate text-13 font-medium text-primary">{a.title}</span>
                </div>
                <div className="mt-1 text-11 text-tertiary">
                  {a.projectName} · {a.stageLabel} · 负责人 {a.assignee} · 截止 {a.dueDate}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <FsTag>{TASK_STATE_META[a.state]?.label ?? a.state}</FsTag>
                <FsTag>{PRIORITY_LABEL[a.priority]}</FsTag>
              </div>
            </Link>
          ))}
          {list.length === 0 && (
            <div className="rounded-lg border border-dashed border-subtle px-4 py-10 text-center text-13 text-tertiary">
              当前筛选下没有任务
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
