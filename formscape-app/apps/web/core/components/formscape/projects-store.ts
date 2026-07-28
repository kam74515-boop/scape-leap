import { useEffect, useState } from "react";
import { PM_PROJECTS, type PmProject } from "./pm-mock";
import {
  ensureFsHydrated,
  isFsHydrated,
  putFsDoc,
  readFsCache,
  registerFsEntity,
  replaceFsDocs,
} from "./fs-data-client";

export const PROJECTS_CHANGE_EVENT = "fs-projects-change";

registerFsEntity("projects", PROJECTS_CHANGE_EVENT);
ensureFsHydrated(["projects"]);

export type CreateProjectInput = {
  name: string;
  identifier: string;
  clientName: string;
  city: string;
  houseType: string;
  budgetWan: number;
  designFeeWan: number;
  owner: string;
  members: string[];
};

function backfillLegacyCatalog(): PmProject[] {
  return replaceFsDocs("projects", PM_PROJECTS);
}

/**
 * 项目目录统一读取入口。
 * 旧数据库没有 projects 实体时，在首次 hydrate 后用旧静态目录回填一次。
 */
export function listProjects(): PmProject[] {
  const projects = readFsCache<PmProject>("projects");
  if (projects.length > 0) return projects;
  if (isFsHydrated("projects")) return backfillLegacyCatalog();
  return PM_PROJECTS;
}

export function getProjectById(id: string): PmProject | undefined {
  return listProjects().find((project) => project.id === id);
}

function createProjectId() {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : `${Date.now()}`;
  return `proj-${suffix}`;
}

export function createProject(input: CreateProjectInput): PmProject {
  const project: PmProject = {
    id: createProjectId(),
    name: input.name.trim(),
    identifier: input.identifier.trim().toUpperCase(),
    stageLabel: "需求分析",
    stageId: "requirements",
    clientName: input.clientName.trim() || "待填写",
    city: input.city.trim() || "待填写",
    houseType: input.houseType.trim() || "待填写",
    progress: 0,
    openTasks: 0,
    overdueTasks: 0,
    budgetWan: input.budgetWan,
    designFeeWan: input.designFeeWan,
    feeCollectedWan: 0,
    updatedAt: new Date().toISOString(),
    risk: "正常",
    owner: input.owner,
    members: Array.from(new Set([input.owner, ...input.members].filter(Boolean))),
  };
  return putFsDoc("projects", project);
}

export function updateProject(id: string, patch: Partial<PmProject>): PmProject | null {
  const current = getProjectById(id);
  if (!current) return null;
  return putFsDoc("projects", {
    ...current,
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  });
}

export function isProjectIdentifierTaken(identifier: string): boolean {
  const normalized = identifier.trim().toUpperCase();
  return listProjects().some((project) => project.identifier.toUpperCase() === normalized);
}

export function useProjects() {
  const [projects, setProjects] = useState(listProjects);
  const [ready, setReady] = useState(() => isFsHydrated("projects"));

  useEffect(() => {
    const refresh = () => {
      setProjects([...listProjects()]);
      setReady(isFsHydrated("projects"));
    };
    refresh();
    window.addEventListener(PROJECTS_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(PROJECTS_CHANGE_EVENT, refresh);
  }, []);

  return { projects, ready };
}
