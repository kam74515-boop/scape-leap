/**
 * 项目 · 任务 — 默认日历视图（tasks-store · localStorage CRUD）
 * 任务可绑定 stageId（设计阶段）；经营类 stageId=null
 * 刻意无 AI 区：纯管理，不替代阶段确认态
 */
import { useMemo, useState, type DragEvent } from "react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Pencil, Plus, Trash2 } from "@/icons";
import { cn } from "@plane/utils";
import { getProjectById } from "./projects-store";
import { STAGES, type StageId } from "./types";
import { useProjectProgress } from "./use-project-progress";
import { stageStateLabel, type StageState } from "./project-progress-store";
import {
  formatDateKey,
  TASK_ASSIGNEES,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATE_LABEL,
  TASK_STATES,
  toDateKey,
  useTasksStore,
  type StoredTask,
  type TaskPriority,
  type TaskState,
} from "./tasks-store";
import {
  FsButton,
  FsConfirm,
  FsField,
  FsModal,
  FsMuted,
  FsPageBody,
  FsPageShell,
  FsPageTitle,
  FsTag,
  fsInputClass,
} from "./ui";

type Props = {
  workspaceSlug: string;
  projectId: string;
};

type StageFilter = "all" | StageId | "biz";

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

type TaskFormState = {
  title: string;
  stageId: StageId | "biz";
  assignee: string;
  startDate: string;
  dueDate: string;
  priority: TaskPriority;
  state: TaskState;
};

const emptyForm = (): TaskFormState => ({
  title: "",
  stageId: "biz",
  assignee: TASK_ASSIGNEES[0],
  startDate: toDateKey(new Date()),
  dueDate: toDateKey(addDays(new Date(), 3)),
  priority: "medium",
  state: "todo",
});

export function FormscapeProjectTasksPage({ workspaceSlug, projectId }: Props) {
  const project = getProjectById(projectId);
  const { projectTasks: all, create, update, remove } = useTasksStore(projectId);
  const { state } = useProjectProgress(projectId);
  const [view, setView] = useState<"calendar" | "board" | "list">("calendar");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StoredTask | null>(null);
  const [form, setForm] = useState<TaskFormState>(emptyForm);
  const [deleting, setDeleting] = useState<StoredTask | null>(null);
  const [detail, setDetail] = useState<StoredTask | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskState | null>(null);
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
    const map: Record<TaskState, StoredTask[]> = {
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
  const todayKey = toDateKey(new Date());

  const byDay = useMemo(() => {
    const map: StoredTask[][] = Array.from({ length: 7 }, () => []);
    const dayKeys = weekDays.map(toDateKey);
    for (const t of filtered) {
      if (!t.dueDate) continue;
      const idx = dayKeys.indexOf(t.dueDate);
      if (idx >= 0) map[idx].push(t);
    }
    return map;
  }, [filtered, weekDays]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm(),
      stageId: stageFilter !== "all" && stageFilter !== "biz" ? stageFilter : "biz",
    });
    setModalOpen(true);
  };

  const openEdit = (t: StoredTask) => {
    setEditing(t);
    setForm({
      title: t.title,
      stageId: t.stageId ?? "biz",
      assignee: t.assignee,
      startDate: t.startDate ?? "",
      dueDate: t.dueDate ?? "",
      priority: t.priority,
      state: t.state,
    });
    setDetail(null);
    setModalOpen(true);
  };

  const submit = () => {
    if (!form.title.trim()) {
      setToast({ type: TOAST_TYPE.ERROR, title: "请填写任务标题" });
      return;
    }
    const stageId = form.stageId === "biz" ? null : form.stageId;
    if (editing) {
      update(editing.id, {
        title: form.title,
        stageId,
        assignee: form.assignee,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        priority: form.priority,
        state: form.state,
      });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "任务已更新", message: form.title });
    } else {
      create({
        title: form.title,
        projectId,
        stageId,
        assignee: form.assignee,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        priority: form.priority,
        state: form.state,
      });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "任务已创建", message: form.title });
    }
    setModalOpen(false);
  };

  const onDropToColumn = (e: DragEvent, col: TaskState) => {
    e.preventDefault();
    setDragOverCol(null);
    const id = e.dataTransfer.getData("text/fs-task-id");
    if (!id) return;
    const task = all.find((t) => t.id === id);
    if (!task || task.state === col) return;
    update(id, { state: col });
  };

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
            <FsPageTitle>任务</FsPageTitle>
            <FsMuted className="mt-0.5">
              {title} · {filterLabel} · {filtered.length}/{all.length} 项 · 绑定 stageId，不替代阶段确认
            </FsMuted>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-subtle p-0.5">
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
                    "rounded-full px-2.5 py-1 text-11 font-medium transition-colors",
                    view === k ? "bg-accent-primary text-on-color" : "text-secondary hover:bg-surface-2"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <FsButton size="sm" onClick={openCreate}>
              <Plus className="size-3.5" strokeWidth={1.75} />
              新建任务
            </FsButton>
          </div>
        </div>

        {/* 按设计阶段筛选（真 stageId 绑定） */}
        <div className="mb-3 flex flex-wrap gap-1.5">
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
            {all.length === 0 ? "该项目暂无任务 — 点右上「新建任务」" : "当前阶段筛选下无任务"}
          </div>
        ) : view === "calendar" ? (
          <div className="grid min-h-0 flex-1 grid-cols-7 gap-1.5 overflow-auto pb-2">
            {weekDays.map((day, i) => {
              const isToday = toDateKey(day) === todayKey;
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
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setDetail(t)}
                        className="rounded-md border border-subtle bg-surface-2/60 px-1.5 py-1.5 text-left transition-colors hover:border-accent-primary/40"
                      >
                        <div className="font-mono text-10 text-placeholder">{t.key}</div>
                        <div className="mt-0.5 line-clamp-2 text-11 font-medium leading-snug text-primary">
                          {t.title}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-0.5">
                          <FsTag>{t.stageLabel}</FsTag>
                          <FsTag tone={t.state === "done" ? "success" : "neutral"}>
                            {TASK_STATE_LABEL[t.state]}
                          </FsTag>
                        </div>
                      </button>
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
            {TASK_STATES.map((col) => (
              <div
                key={col}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverCol(col);
                }}
                onDragLeave={() => setDragOverCol((c) => (c === col ? null : c))}
                onDrop={(e) => onDropToColumn(e, col)}
                className={cn(
                  "flex min-w-[200px] flex-col rounded-lg bg-surface-2/80 p-2 transition-colors",
                  dragOverCol === col && "bg-accent-subtle/70 ring-1 ring-accent-primary/40"
                )}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-11 font-semibold text-secondary">{TASK_STATE_LABEL[col]}</span>
                  <span className="text-11 text-placeholder tabular-nums">{byState[col].length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {byState[col].map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      stageState={t.stageId ? state.stageStates[t.stageId] : undefined}
                      onClick={() => setDetail(t)}
                    />
                  ))}
                  {byState[col].length === 0 && (
                    <div className="rounded-md border border-dashed border-subtle px-2 py-6 text-center text-11 text-placeholder">
                      拖到这里
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
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-subtle bg-surface-1 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-11 text-placeholder">{t.key}</span>
                    <span className="text-13 font-medium text-primary">{t.title}</span>
                  </div>
                  <div className="mt-0.5 text-11 text-tertiary">
                    {t.stageLabel}
                    {" · "}
                    {t.assignee} · {formatDateKey(t.startDate)} → {formatDateKey(t.dueDate)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {t.stageId && <FsTag>{stageStateLabel(state.stageStates[t.stageId])}</FsTag>}
                  <FsTag tone={t.priority === "urgent" ? "danger" : t.priority === "high" ? "warning" : "neutral"}>
                    {TASK_PRIORITY_LABEL[t.priority]}
                  </FsTag>
                  {/* 行内改状态 */}
                  <select
                    className="h-7 rounded-md border border-subtle bg-surface-1 px-1.5 text-11 text-secondary"
                    value={t.state}
                    onChange={(e) => update(t.id, { state: e.target.value as TaskState })}
                  >
                    {TASK_STATES.map((s) => (
                      <option key={s} value={s}>
                        {TASK_STATE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="rounded-full p-1.5 text-tertiary hover:bg-surface-2 hover:text-primary"
                    aria-label="编辑任务"
                  >
                    <Pencil className="size-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(t)}
                    className="rounded-full p-1.5 text-tertiary hover:bg-danger-subtle hover:text-danger-primary"
                    aria-label="删除任务"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <FsMuted className="mt-2">
          默认日历（只读，点开详情）· 看板可拖拽换列 · 列表行内改状态 · 阶段确认在「设计阶段」页操作
        </FsMuted>

        {/* 新建 / 编辑 */}
        <FsModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editing ? `编辑任务 · ${editing.key}` : "新建任务"}
          width="md"
          footer={
            <>
              <FsButton variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
                取消
              </FsButton>
              <FsButton size="sm" onClick={submit}>
                {editing ? "保存修改" : "创建任务"}
              </FsButton>
            </>
          }
        >
          <div className="space-y-3">
            <FsField label="标题">
              <input
                className={fsInputClass}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="要做成什么事"
              />
            </FsField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FsField label="所属阶段">
                <select
                  className={fsInputClass}
                  value={form.stageId}
                  onChange={(e) => setForm((f) => ({ ...f, stageId: e.target.value as StageId | "biz" }))}
                >
                  <option value="biz">经营（无设计阶段）</option>
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </FsField>
              <FsField label="负责人">
                <select
                  className={fsInputClass}
                  value={form.assignee}
                  onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}
                >
                  {TASK_ASSIGNEES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </FsField>
              <FsField label="开始日期">
                <input
                  type="date"
                  className={fsInputClass}
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </FsField>
              <FsField label="截止日期">
                <input
                  type="date"
                  className={fsInputClass}
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </FsField>
              <FsField label="优先级">
                <select
                  className={fsInputClass}
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
                >
                  {TASK_PRIORITIES.map((x) => (
                    <option key={x} value={x}>
                      {TASK_PRIORITY_LABEL[x]}
                    </option>
                  ))}
                </select>
              </FsField>
              {editing && (
                <FsField label="状态">
                  <select
                    className={fsInputClass}
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value as TaskState }))}
                  >
                    {TASK_STATES.map((s) => (
                      <option key={s} value={s}>
                        {TASK_STATE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </FsField>
              )}
            </div>
          </div>
        </FsModal>

        {/* 详情（日历/看板点开） */}
        <FsModal
          open={!!detail}
          onClose={() => setDetail(null)}
          title={detail ? `${detail.key} · 任务详情` : undefined}
          footer={
            detail ? (
              <>
                <FsButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDeleting(detail);
                    setDetail(null);
                  }}
                >
                  删除
                </FsButton>
                <FsButton size="sm" onClick={() => detail && openEdit(detail)}>
                  编辑
                </FsButton>
              </>
            ) : undefined
          }
        >
          {detail && (
            <div className="space-y-2">
              <div className="text-14 font-medium text-primary">{detail.title}</div>
              <div className="flex flex-wrap gap-1.5">
                <FsTag>{detail.stageLabel}</FsTag>
                <FsTag tone={detail.state === "done" ? "success" : "brand"}>
                  {TASK_STATE_LABEL[detail.state]}
                </FsTag>
                <FsTag tone={detail.priority === "urgent" ? "danger" : detail.priority === "high" ? "warning" : "neutral"}>
                  {TASK_PRIORITY_LABEL[detail.priority]}
                </FsTag>
              </div>
              <FsMuted>
                负责人 {detail.assignee} · {formatDateKey(detail.startDate)} → {formatDateKey(detail.dueDate)}
              </FsMuted>
            </div>
          )}
        </FsModal>

        <FsConfirm
          open={!!deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            if (deleting) {
              remove(deleting.id);
              setToast({ type: TOAST_TYPE.SUCCESS, title: "任务已删除", message: deleting.title });
            }
            setDeleting(null);
          }}
          title="删除任务？"
          body={deleting ? `「${deleting.title}」将从看板与日历移除。` : undefined}
          confirmLabel="删除"
          danger
        />
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
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-11 font-medium transition-colors",
        active
          ? "border-accent-primary/40 bg-accent-subtle text-accent-primary"
          : "border-subtle bg-surface-1 text-secondary hover:bg-surface-2"
      )}
    >
      {label}
      {hint && !active && <span className="text-10 text-placeholder">{hint}</span>}
    </button>
  );
}

function TaskCard({
  task,
  stageState,
  onClick,
}: {
  task: StoredTask;
  stageState?: StageState;
  onClick?: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/fs-task-id", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onClick}
      className="cursor-grab rounded-lg border border-subtle bg-surface-1 p-2.5 transition-[transform,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-strong active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-mono text-11 text-placeholder">{task.key}</span>
        <FsTag tone={task.priority === "urgent" ? "danger" : task.priority === "high" ? "warning" : "neutral"}>
          {TASK_PRIORITY_LABEL[task.priority]}
        </FsTag>
      </div>
      <div className="mt-1 text-13 font-medium leading-snug text-primary">{task.title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1 text-11 text-tertiary">
        <FsTag>{task.stageLabel}</FsTag>
        {stageState && <FsTag>{stageStateLabel(stageState)}</FsTag>}
        <span>{task.assignee}</span>
        <span className="ml-auto tabular-nums">{formatDateKey(task.dueDate)}</span>
      </div>
    </div>
  );
}
