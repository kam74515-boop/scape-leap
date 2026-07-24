/**
 * 项目 · 任务 — 默认日历视图
 * 任务可绑定 stageId（设计阶段）；经营类 stageId=null
 * 不替代阶段确认态
 */
import { useMemo, useState } from "react";
import { cn } from "@plane/utils";
import {
  PRIORITY_LABEL,
  projectById,
  TASK_STATE_META,
  tasksForProject,
  type ProjectTask,
} from "./pm-mock";
import { STAGES, type StageId } from "./types";
import { useProjectProgress } from "./use-project-progress";
import { stageStateLabel, type StageState } from "./project-progress-store";
import { FsMuted, FsPageBody, FsPageShell, FsTag } from "./ui";

type Props = {
  workspaceSlug: string;
  projectId: string;
};

type StageFilter = "all" | StageId | "biz";

const COLUMNS: ProjectTask["state"][] = ["todo", "in_progress", "review", "done"];

/** Demo：把 dueDate 文案映射到本周相对日偏移 */
function dueOffset(due: string): number {
  if (due === "今天" || due.includes("今天")) return 0;
  if (due === "明天" || due.includes("明天")) return 1;
  if (due.includes("周三")) return 2;
  if (due.includes("周五") || due.includes("本周五")) return 4;
  if (due.includes("下周一")) return 7;
  if (due.includes("下周三")) return 9;
  if (due.includes("本周")) return 3;
  if (due.includes("下周")) return 8;
  if (due.includes("已完成")) return -1;
  return 2;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtDay(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export function FormscapeProjectTasksPage({ workspaceSlug, projectId }: Props) {
  const project = projectById(projectId);
  const all = useMemo(() => tasksForProject(projectId), [projectId]);
  const { state } = useProjectProgress(projectId);
  const [view, setView] = useState<"calendar" | "board" | "list">("calendar");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  void workspaceSlug;

  const filtered = useMemo(() => {
    if (stageFilter === "all") return all;
    if (stageFilter === "biz") return all.filter((t) => t.stageId === null);
    return all.filter((t) => t.stageId === stageFilter);
  }, [all, stageFilter]);

  const stageCounts = useMemo(() => {
    const map: Record<string, number> = { all: all.length, biz: 0 };
    for (const s of STAGES) map[s.id] = 0;
    for (const t of all) {
      if (t.stageId === null) map.biz += 1;
      else if (map[t.stageId] !== undefined) map[t.stageId] += 1;
    }
    return map;
  }, [all]);

  const byState = useMemo(() => {
    const map: Record<ProjectTask["state"], ProjectTask[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };
    for (const t of filtered) map[t.state].push(t);
    return map;
  }, [filtered]);

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const byDay = useMemo(() => {
    const map: ProjectTask[][] = Array.from({ length: 7 }, () => []);
    for (const t of filtered) {
      const off = dueOffset(t.dueDate);
      if (off < 0 || off > 13) continue;
      const idx = Math.min(6, Math.max(0, off));
      map[idx].push(t);
    }
    return map;
  }, [filtered]);

  const title = project ? project.name : "项目任务";
  const filterLabel =
    stageFilter === "all"
      ? "全部阶段"
      : stageFilter === "biz"
        ? "经营类"
        : STAGES.find((s) => s.id === stageFilter)?.label ?? stageFilter;

  return (
    <FsPageShell>
      <FsPageBody className="flex flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-13 font-semibold text-primary">任务</div>
            <FsMuted className="mt-0.5">
              {title} · {filterLabel} · {filtered.length}/{all.length} 项 · 绑定 stageId，不替代阶段确认
            </FsMuted>
          </div>
          <div className="flex rounded-md border border-subtle p-0.5">
            {(
              [
                ["calendar", "日历"],
                ["board", "看板"],
                ["list", "列表"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setView(k)}
                className={cn(
                  "rounded px-2.5 py-1 text-11 font-medium",
                  view === k ? "bg-accent-primary text-on-color" : "text-secondary hover:bg-surface-2"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 按设计阶段筛选 */}
        <div className="mb-3 flex flex-wrap gap-1">
          <FilterChip
            active={stageFilter === "all"}
            label={`全部 ${stageCounts.all}`}
            onClick={() => setStageFilter("all")}
          />
          {STAGES.map((s) => {
            const st = state.stageStates[s.id];
            const n = stageCounts[s.id] ?? 0;
            return (
              <FilterChip
                key={s.id}
                active={stageFilter === s.id}
                label={`${s.label} ${n}`}
                hint={stageStateLabel(st)}
                onClick={() => setStageFilter(s.id)}
              />
            );
          })}
          <FilterChip
            active={stageFilter === "biz"}
            label={`经营 ${stageCounts.biz}`}
            hint="无 stageId"
            onClick={() => setStageFilter("biz")}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-subtle px-4 py-16 text-center text-13 text-tertiary">
            {all.length === 0 ? "该项目暂无 Demo 任务" : "当前阶段筛选下无任务"}
          </div>
        ) : view === "calendar" ? (
          <div className="grid min-h-0 flex-1 grid-cols-7 gap-1.5 overflow-auto pb-2">
            {weekDays.map((day, i) => {
              const isToday = dueOffset("今天") === i;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex min-h-[220px] flex-col rounded-lg border border-subtle bg-surface-1",
                    isToday && "border-accent-primary/40"
                  )}
                >
                  <div
                    className={cn(
                      "border-b border-subtle px-2 py-1.5 text-center text-11 font-medium",
                      isToday ? "bg-accent-subtle text-accent-primary" : "text-secondary"
                    )}
                  >
                    周{WEEKDAYS[i]} · {fmtDay(day)}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-1.5">
                    {byDay[i].map((t) => (
                      <div
                        key={t.id}
                        className="rounded-md border border-subtle bg-surface-2/60 px-1.5 py-1.5"
                      >
                        <div className="font-mono text-[10px] text-placeholder">{t.key}</div>
                        <div className="mt-0.5 line-clamp-2 text-11 font-medium leading-snug text-primary">
                          {t.title}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-0.5">
                          <FsTag>{t.stageLabel}</FsTag>
                          <FsTag>{TASK_STATE_META[t.state].label}</FsTag>
                        </div>
                      </div>
                    ))}
                    {byDay[i].length === 0 && (
                      <div className="flex flex-1 items-center justify-center text-11 text-placeholder">—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : view === "board" ? (
          <div className="grid min-h-0 flex-1 gap-3 overflow-x-auto pb-2 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col} className="flex min-w-[200px] flex-col rounded-lg bg-surface-2/80 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-11 font-semibold text-secondary">{TASK_STATE_META[col].column}</span>
                  <span className="text-11 text-placeholder">{byState[col].length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {byState[col].map((t) => (
                    <TaskCard key={t.id} task={t} stageState={t.stageId ? state.stageStates[t.stageId as StageId] : undefined} />
                  ))}
                  {byState[col].length === 0 && (
                    <div className="rounded-md border border-dashed border-subtle px-2 py-6 text-center text-11 text-placeholder">
                      无
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-subtle bg-surface-1 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-11 text-placeholder">{t.key}</span>
                    <span className="text-13 font-medium text-primary">{t.title}</span>
                  </div>
                  <div className="mt-0.5 text-11 text-tertiary">
                    {t.stageLabel}
                    {t.stageId ? ` · ${t.stageId}` : " · 无 stageId"}
                    {" · "}
                    {t.assignee} · 截止 {t.dueDate}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {t.stageId && (
                    <FsTag>{stageStateLabel(state.stageStates[t.stageId as StageId])}</FsTag>
                  )}
                  <FsTag>{TASK_STATE_META[t.state].label}</FsTag>
                  <FsTag>{PRIORITY_LABEL[t.priority]}</FsTag>
                </div>
              </div>
            ))}
          </div>
        )}
        <FsMuted className="mt-2">
          默认日历 · stageId 关联设计阶段 · 经营任务无 stageId · 阶段确认在「设计阶段」页操作
        </FsMuted>
      </FsPageBody>
    </FsPageShell>
  );
}

function FilterChip({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-11 font-medium transition-colors",
        active
          ? "border-accent-primary/40 bg-accent-subtle text-accent-primary"
          : "border-subtle bg-surface-1 text-secondary hover:bg-surface-2"
      )}
    >
      {label}
      {hint && !active && <span className="text-[10px] text-placeholder">{hint}</span>}
    </button>
  );
}

function TaskCard({
  task,
  stageState,
}: {
  task: ProjectTask;
  stageState?: StageState;
}) {
  return (
    <div className="rounded-md border border-subtle bg-surface-1 p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-1">
        <span className="font-mono text-11 text-placeholder">{task.key}</span>
        <FsTag>{PRIORITY_LABEL[task.priority]}</FsTag>
      </div>
      <div className="mt-1 text-13 font-medium leading-snug text-primary">{task.title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1 text-11 text-tertiary">
        <FsTag>{task.stageLabel}</FsTag>
        {stageState && <FsTag>{stageStateLabel(stageState)}</FsTag>}
        <span>{task.assignee}</span>
        <span className="ml-auto">{task.dueDate}</span>
      </div>
    </div>
  );
}
