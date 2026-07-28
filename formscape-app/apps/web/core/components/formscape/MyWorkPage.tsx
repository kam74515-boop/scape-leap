/**
 * 我的工作 = 分配给我的跨项目任务（tasks-store 真数据）
 * 顶栏由 profile layout AppHeader 负责，页内不再套 FsPageHeader
 */
import { Link } from "react-router";
import { useMemo, useState } from "react";
import { cn } from "@plane/utils";
import { listProjects } from "./projects-store";
import {
  formatDateKey,
  TASK_PRIORITY_LABEL,
  TASK_STATE_LABEL,
  useTasksStore,
} from "./tasks-store";
import { FsEmpty, FsMuted, FsTag } from "./ui";

type Props = { workspaceSlug: string };

const FILTERS = ["全部", "进行中", "待办", "待确认", "紧急", "已完成"] as const;

export function FormscapeMyWorkPage({ workspaceSlug }: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("全部");
  const { tasks } = useTasksStore();
  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of listProjects()) map.set(p.id, p.name);
    return map;
  }, []);

  const list = useMemo(() => {
    return tasks.filter((a) => {
      if (filter === "进行中") return a.state === "in_progress";
      if (filter === "待办") return a.state === "todo";
      if (filter === "待确认") return a.state === "review";
      if (filter === "紧急") return a.priority === "urgent" || a.priority === "high";
      if (filter === "已完成") return a.state === "done";
      return true;
    });
  }, [filter, tasks]);

  const openCount = tasks.filter((a) => a.state !== "done").length;

  return (
    <div className="h-full overflow-y-auto bg-surface-1 px-3 py-4 md:px-4">
      <div className="mx-auto w-full max-w-[900px] space-y-3">
        <div className="rounded-lg border border-accent-primary/20 bg-accent-subtle/40 px-3 py-2 text-11 text-secondary">
          与 Plane「个人资料」不同：这里是<strong className="text-primary">工作内容分配</strong>
          ——跨项目看你要做的事 · 未完成 {openCount} 项 · 与项目「任务」同源
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-2.5 py-1 text-11 font-medium transition-colors",
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
              className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface-1 px-3 py-3 transition-[transform,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-strong sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-11 text-placeholder">{a.key}</span>
                  <span className="truncate text-13 font-medium text-primary">{a.title}</span>
                </div>
                <div className="mt-1 text-11 text-tertiary">
                  {projectNameById.get(a.projectId) ?? a.projectId} · {a.stageLabel} · 负责人 {a.assignee} · 截止{" "}
                  {formatDateKey(a.dueDate)}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <FsTag tone={a.state === "done" ? "success" : a.state === "in_progress" ? "brand" : "neutral"}>
                  {TASK_STATE_LABEL[a.state]}
                </FsTag>
                <FsTag tone={a.priority === "urgent" ? "danger" : a.priority === "high" ? "warning" : "neutral"}>
                  {TASK_PRIORITY_LABEL[a.priority]}
                </FsTag>
              </div>
            </Link>
          ))}
          {list.length === 0 && (
            <FsEmpty title="当前筛选下没有任务" body="换一个筛选，或到项目里新建任务分配给自己。" />
          )}
        </div>
      </div>
    </div>
  );
}
