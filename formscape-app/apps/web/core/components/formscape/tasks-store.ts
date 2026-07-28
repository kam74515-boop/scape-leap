/**
 * 项目任务 Store（Demo · SQLite 持久化）
 * 真源 = 服务端 SQLite（/api/fs/tasks|drafts|drafts_hidden，经 fs-data-client 缓存）；
 * 种子由服务端 fs-seed.mjs 首次建库播种。任务是刻意无 AI 区：纯 CRUD，不做自动推进。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DraftItem } from "./pm-mock";
import { getProjectById } from "./projects-store";
import { STAGES, type StageId } from "./types";
import { ensureFsHydrated, putFsDoc, readFsCache, registerFsEntity, replaceFsDocs } from "./fs-data-client";

export type TaskState = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "urgent" | "high" | "medium" | "low";

export type StoredTask = {
  id: string;
  key: string;
  title: string;
  projectId: string;
  /** 关联设计阶段；经营类为 null */
  stageId: StageId | null;
  /** 展示标签（经营类保留「经营·xx」文案；阶段类由 stageId 派生） */
  stageLabel: string;
  priority: TaskPriority;
  state: TaskState;
  assignee: string;
  /** yyyy-mm-dd */
  startDate: string | null;
  /** yyyy-mm-dd */
  dueDate: string | null;
  createdAt: string;
  source: "seed" | "user" | "draft";
};

export const TASKS_CHANGE_EVENT = "fs-project-tasks-change";

// 数据真源注册（fs-data-client：change 事件沿用 TASKS_CHANGE_EVENT）+ 后台 hydrate
registerFsEntity("tasks", TASKS_CHANGE_EVENT);
registerFsEntity("drafts", TASKS_CHANGE_EVENT);
registerFsEntity("drafts_hidden", TASKS_CHANGE_EVENT);
ensureFsHydrated(["tasks", "drafts", "drafts_hidden"]);

export const TASK_STATES: TaskState[] = ["todo", "in_progress", "review", "done"];

export const TASK_STATE_LABEL: Record<TaskState, string> = {
  todo: "待办",
  in_progress: "进行中",
  review: "待确认",
  done: "完成",
};

export const TASK_PRIORITIES: TaskPriority[] = ["urgent", "high", "medium", "low"];

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: "紧急",
  high: "高",
  medium: "中",
  low: "低",
};

export const TASK_ASSIGNEES = ["林设计师", "周软装", "阿凯深化", "结构顾问"];

/* ---------- 日期工具 ---------- */

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysKey(base: Date, offset: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return toDateKey(d);
}

export function formatDateKey(key: string | null): string {
  if (!key) return "未定";
  const [, m, d] = key.split("-");
  if (!m || !d) return key;
  return `${Number(m)}/${Number(d)}`;
}

export function stageLabelOf(stageId: StageId | null): string {
  if (!stageId) return "经营";
  return STAGES.find((s) => s.id === stageId)?.label ?? stageId;
}

/* ---------- 存取（SQLite via fs-data-client） ---------- */

function load(): StoredTask[] {
  return readFsCache<StoredTask>("tasks");
}

function save(tasks: StoredTask[], notify = true) {
  void notify; // 事件由 fs-data-client 统一发射（TASKS_CHANGE_EVENT）
  replaceFsDocs("tasks", tasks);
}

export function listTasks(): StoredTask[] {
  return load();
}

export function listTasksForProject(projectId: string): StoredTask[] {
  return load().filter((t) => t.projectId === projectId);
}

export function nextTaskKey(projectId: string): string {
  const prefix = getProjectById(projectId)?.identifier ?? "T";
  const nums = load()
    .filter((t) => t.projectId === projectId && t.key.startsWith(`${prefix}-`))
    .map((t) => Number(t.key.split("-")[1]))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${next}`;
}

export type NewTaskInput = {
  title: string;
  projectId: string;
  stageId: StageId | null;
  priority: TaskPriority;
  state?: TaskState;
  assignee: string;
  startDate?: string | null;
  dueDate?: string | null;
  stageLabel?: string;
  source?: StoredTask["source"];
};

export function addTask(input: NewTaskInput): StoredTask {
  const tasks = load();
  const task: StoredTask = {
    id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    key: nextTaskKey(input.projectId),
    title: input.title.trim() || "未命名任务",
    projectId: input.projectId,
    stageId: input.stageId,
    stageLabel: input.stageLabel ?? stageLabelOf(input.stageId),
    priority: input.priority,
    state: input.state ?? "todo",
    assignee: input.assignee || TASK_ASSIGNEES[0],
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    createdAt: new Date().toISOString(),
    source: input.source ?? "user",
  };
  save([task, ...tasks]);
  return task;
}

export function updateTask(
  id: string,
  patch: Partial<Omit<StoredTask, "id" | "key" | "projectId" | "createdAt" | "source">>
): StoredTask[] {
  const tasks = load().map((t) => {
    if (t.id !== id) return t;
    const next = { ...t, ...patch };
    if (patch.stageId !== undefined && patch.stageLabel === undefined) {
      next.stageLabel = stageLabelOf(patch.stageId);
    }
    return next;
  });
  save(tasks);
  return tasks;
}

export function removeTask(id: string): StoredTask[] {
  const tasks = load().filter((t) => t.id !== id);
  save(tasks);
  return tasks;
}

/* ---------- 草稿箱（发布 / 删除后隐藏种子草稿；SQLite via fs-data-client） ---------- */

function loadHiddenDraftIds(): string[] {
  return readFsCache<{ id: string }>("drafts_hidden").map((d) => d.id);
}

export function listDrafts(): DraftItem[] {
  const hidden = new Set(loadHiddenDraftIds());
  return readFsCache<DraftItem>("drafts").filter((d) => !hidden.has(d.id));
}

export function hideDraft(id: string) {
  const hidden = loadHiddenDraftIds();
  if (hidden.includes(id)) return;
  putFsDoc("drafts_hidden", { id });
}

/** 草稿 → 正式任务（写入任务 store 并隐藏草稿） */
export function publishDraftAsTask(draft: DraftItem): StoredTask | null {
  if (!draft.projectId) return null;
  const task = addTask({
    title: draft.title,
    projectId: draft.projectId,
    stageId: null,
    stageLabel: `草稿·${draft.kind}`,
    priority: "medium",
    assignee: TASK_ASSIGNEES[0],
    dueDate: addDaysKey(new Date(), 3),
    source: "draft",
  });
  hideDraft(draft.id);
  return task;
}

/* ---------- hooks ---------- */

export function useTasksStore(projectId?: string) {
  const [tasks, setTasks] = useState<StoredTask[]>(() =>
    typeof window === "undefined" ? [] : listTasks()
  );

  const refresh = useCallback(() => {
    setTasks(listTasks());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(TASKS_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(TASKS_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const projectTasks = useMemo(
    () => (projectId ? tasks.filter((t) => t.projectId === projectId) : tasks),
    [tasks, projectId]
  );

  const create = useCallback((input: NewTaskInput) => {
    const task = addTask(input);
    return task;
  }, []);

  const update = useCallback(
    (id: string, patch: Parameters<typeof updateTask>[1]) => {
      updateTask(id, patch);
    },
    []
  );

  const remove = useCallback((id: string) => {
    removeTask(id);
  }, []);

  return { tasks, projectTasks, refresh, create, update, remove };
}

export function useDrafts() {
  const [drafts, setDrafts] = useState<DraftItem[]>(() =>
    typeof window === "undefined" ? [] : listDrafts()
  );
  useEffect(() => {
    const onChange = () => setDrafts(listDrafts());
    onChange();
    window.addEventListener(TASKS_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(TASKS_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return { drafts };
}
