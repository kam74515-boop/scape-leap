/**
 * 项目文件 Store（SQLite 持久化）
 * 元数据与 5MB 内文件内容都写入服务端 SQLite；刷新后仍可预览、下载。
 * 文件是刻意无 AI 区：纯上传 / 归类 / 删除
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { StageId } from "./types";
import { ensureFsHydrated, putFsDoc, readFsCache, registerFsEntity, removeFsDoc } from "./fs-data-client";

export type ProjectFileKind = "图纸" | "效果图" | "清单" | "合同" | "汇报" | "其他";

export const FILE_KINDS: ProjectFileKind[] = ["图纸", "效果图", "清单", "合同", "汇报", "其他"];
export const MAX_PROJECT_FILE_BYTES = 5 * 1024 * 1024;

export type ProjectFile = {
  id: string;
  projectId: string;
  name: string;
  kind: ProjectFileKind;
  /** 按设计阶段归类；null = 未归阶段 */
  stageId: StageId | null;
  sizeLabel: string;
  /** yyyy-mm-dd */
  date: string;
  mime: string;
  /** data URL；5MB 内文件直接持久化，刷新后仍可下载。 */
  contentDataUrl?: string;
  /** 是否允许安全 Portal 响应返回此文件。 */
  portalVisible?: boolean;
  /** 种子演示文件（无本地内容） */
  seed?: boolean;
};

export const FILES_CHANGE_EVENT = "fs-project-files-change";

registerFsEntity("files", FILES_CHANGE_EVENT);
ensureFsHydrated(["files"]);

/* 种子文件已迁至服务端 fs-seed.mjs（SEED_FILES）；种子与普通文件同为 SQLite 行，删除即真删 */

function loadStored(): ProjectFile[] {
  return readFsCache<ProjectFile>("files");
}

export function listFilesForProject(projectId: string): ProjectFile[] {
  return loadStored().filter((f) => f.projectId === projectId);
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function guessFileKind(name: string, mime: string): ProjectFileKind {
  const n = name.toLowerCase();
  if (mime.startsWith("image/")) return "效果图";
  if (/\.(dwg|dxf|pdf)$/.test(n)) return "图纸";
  if (/\.(xls|xlsx|csv)$/.test(n)) return "清单";
  if (/\.(doc|docx)$/.test(n)) return "合同";
  if (/\.(ppt|pptx)$/.test(n)) return "汇报";
  return "其他";
}

async function readFileAsDataUrl(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

export async function addProjectFile(
  projectId: string,
  file: File,
  opts: { kind: ProjectFileKind; stageId: StageId | null; portalVisible?: boolean }
): Promise<ProjectFile> {
  if (file.size > MAX_PROJECT_FILE_BYTES) {
    throw new Error("文件超过 5MB，请压缩后重试");
  }
  const id = `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const contentDataUrl = await readFileAsDataUrl(file);
  const meta: ProjectFile = {
    id,
    projectId,
    name: file.name,
    kind: opts.kind,
    stageId: opts.stageId,
    sizeLabel: formatFileSize(file.size),
    date: new Date().toISOString().slice(0, 10),
    mime: file.type || "application/octet-stream",
    contentDataUrl,
    portalVisible: opts.portalVisible ?? false,
  };
  putFsDoc("files", meta);
  return meta;
}

export function removeProjectFile(id: string) {
  removeFsDoc("files", id);
}

export function getFilePreviewUrl(id: string): string | null {
  return loadStored().find((file) => file.id === id)?.contentDataUrl ?? null;
}

export function downloadProjectFile(file: ProjectFile): boolean {
  if (!file.contentDataUrl || typeof document === "undefined") return false;
  const anchor = document.createElement("a");
  anchor.href = file.contentDataUrl;
  anchor.download = file.name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}

export function useProjectFiles(projectId: string) {
  const [files, setFiles] = useState<ProjectFile[]>(() =>
    typeof window === "undefined" ? [] : listFilesForProject(projectId)
  );

  const refresh = useCallback(() => {
    setFiles(listFilesForProject(projectId));
  }, [projectId]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(FILES_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(FILES_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const upload = useCallback(
    (file: File, opts: { kind: ProjectFileKind; stageId: StageId | null; portalVisible?: boolean }) =>
      addProjectFile(projectId, file, opts),
    [projectId]
  );

  const remove = useCallback((id: string) => {
    removeProjectFile(id);
  }, []);

  const byStage = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of files) {
      const key = f.stageId ?? "none";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [files]);

  return { files, byStage, upload, remove, refresh };
}
