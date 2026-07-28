/**
 * 项目 · 文件 — 服务端持久化
 * 上传 / 刷新后预览 / 下载 · 网格/列表切换 · 删除 · 按阶段归类
 * 刻意无 AI 区：协作数据确定性
 */
import { useMemo, useRef, useState } from "react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Download, Eye, FileText, Image as ImageIcon, LayoutGrid, List, Trash2, Upload } from "@/icons";
import { PageHead } from "@/components/core/page-title";
import { cn } from "@plane/utils";
import { STAGES, type StageId } from "./types";
import { useFormscapeProject } from "./use-formscape-project";
import {
  FILE_KINDS,
  downloadProjectFile,
  getFilePreviewUrl,
  guessFileKind,
  useProjectFiles,
  type ProjectFile,
  type ProjectFileKind,
} from "./files-store";
import {
  FsButton,
  FsConfirm,
  FsEmpty,
  FsField,
  FsModal,
  FsMuted,
  FsPageBody,
  FsPageShell,
  FsPageTitle,
  FsTag,
  fsInputClass,
} from "./ui";

type Props = { workspaceSlug: string; projectId: string };

type StageFilter = "all" | StageId | "none";

function stageLabel(stageId: StageId | null): string {
  if (!stageId) return "未归阶段";
  return STAGES.find((s) => s.id === stageId)?.label ?? stageId;
}

export function FormscapeFilesPage({ projectId }: Props) {
  const { project } = useFormscapeProject(projectId);
  const { files, upload, remove } = useProjectFiles(projectId);
  const [view, setView] = useState<"list" | "grid">("list");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [deleting, setDeleting] = useState<ProjectFile | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [pendingKind, setPendingKind] = useState<ProjectFileKind>("其他");
  const [pendingStage, setPendingStage] = useState<StageId | "none">("none");
  const [pendingPortalVisible, setPendingPortalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (stageFilter === "all") return files;
    if (stageFilter === "none") return files.filter((f) => !f.stageId);
    return files.filter((f) => f.stageId === stageFilter);
  }, [files, stageFilter]);

  const stageCounts = useMemo(() => {
    const map: Record<string, number> = { all: files.length, none: 0 };
    for (const s of STAGES) map[s.id] = 0;
    for (const f of files) {
      if (!f.stageId) map.none += 1;
      else map[f.stageId] = (map[f.stageId] ?? 0) + 1;
    }
    return map;
  }, [files]);

  const onPickFile = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    setPending(file);
    setPendingKind(guessFileKind(file.name, file.type));
    setPendingStage(stageFilter !== "all" && stageFilter !== "none" ? stageFilter : "none");
    setPendingPortalVisible(false);
  };

  const confirmUpload = async () => {
    if (!pending) return;
    setUploading(true);
    try {
      await upload(pending, {
        kind: pendingKind,
        stageId: pendingStage === "none" ? null : pendingStage,
        portalVisible: pendingPortalVisible,
      });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "文件已保存",
        message: `${pending.name} · 刷新后仍可预览与下载`,
      });
      setPending(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "上传失败",
        message: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setUploading(false);
    }
  };

  const openFile = (file: ProjectFile) => {
    const url = getFilePreviewUrl(file.id);
    if (url && (file.mime.startsWith("image/") || file.mime === "application/pdf")) {
      window.open(url, "_blank", "noopener");
      return;
    }
    if (downloadProjectFile(file)) return;
    setToast({
      type: TOAST_TYPE.INFO,
      title: "示例文件没有附件内容",
      message: "上传真实文件后即可预览和下载",
    });
  };

  return (
    <>
      <PageHead title={`${project.name} · 文件`} />
      <FsPageShell>
        <FsPageBody>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <FsPageTitle>文件</FsPageTitle>
              <FsMuted className="mt-0.5">图纸 · 效果图 · 合同 · 清单 · 共 {files.length} 个 · 服务端保存</FsMuted>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-full border border-subtle p-0.5">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-1 text-11 font-medium transition-colors",
                    view === "list" ? "bg-accent-primary text-on-color" : "text-secondary hover:bg-surface-2"
                  )}
                >
                  <List className="size-3.5" strokeWidth={1.75} />
                  列表
                </button>
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-1 text-11 font-medium transition-colors",
                    view === "grid" ? "bg-accent-primary text-on-color" : "text-secondary hover:bg-surface-2"
                  )}
                >
                  <LayoutGrid className="size-3.5" strokeWidth={1.75} />
                  网格
                </button>
              </div>
              <input ref={inputRef} type="file" className="hidden" onChange={(e) => onPickFile(e.target.files)} />
              <FsButton size="sm" onClick={() => inputRef.current?.click()}>
                <Upload className="size-3.5" strokeWidth={1.75} />
                上传文件
              </FsButton>
            </div>
          </div>

          {/* 阶段归类筛选 */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <StageChip
              active={stageFilter === "all"}
              label={`全部 ${stageCounts.all}`}
              onClick={() => setStageFilter("all")}
            />
            {STAGES.filter((s) => (stageCounts[s.id] ?? 0) > 0).map((s) => (
              <StageChip
                key={s.id}
                active={stageFilter === s.id}
                label={`${s.label} ${stageCounts[s.id]}`}
                onClick={() => setStageFilter(s.id)}
              />
            ))}
            {stageCounts.none > 0 && (
              <StageChip
                active={stageFilter === "none"}
                label={`未归阶段 ${stageCounts.none}`}
                onClick={() => setStageFilter("none")}
              />
            )}
          </div>

          {filtered.length === 0 ? (
            <FsEmpty
              title="这里还没有文件"
              body="上传图纸、效果图、合同与清单，按阶段归类，团队随取随用。"
              action={
                <FsButton size="sm" onClick={() => inputRef.current?.click()}>
                  <Upload className="size-3.5" strokeWidth={1.75} />
                  上传第一个文件
                </FsButton>
              }
            />
          ) : view === "list" ? (
            <div className="w-full space-y-1.5">
              {filtered.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-subtle bg-surface-1 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FilePreviewThumb file={f} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-13 font-medium text-primary">{f.name}</div>
                      <div className="text-11 text-tertiary">
                        {f.sizeLabel} · {f.date}
                        {f.seed ? " · 示例元数据" : " · 已保存"}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <FsTag tone="brand">{f.kind}</FsTag>
                    <FsTag>{stageLabel(f.stageId)}</FsTag>
                    {f.portalVisible && <FsTag tone="success">Portal 可见</FsTag>}
                    <button
                      type="button"
                      onClick={() => openFile(f)}
                      className="rounded-full p-1.5 text-tertiary hover:bg-layer-transparent-hover hover:text-primary"
                      aria-label={f.mime.startsWith("image/") || f.mime === "application/pdf" ? "预览文件" : "下载文件"}
                    >
                      {f.mime.startsWith("image/") || f.mime === "application/pdf" ? (
                        <Eye className="size-3.5" strokeWidth={1.75} />
                      ) : (
                        <Download className="size-3.5" strokeWidth={1.75} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(f)}
                      className="rounded-full p-1.5 text-tertiary hover:bg-danger-subtle hover:text-danger-primary"
                      aria-label="删除文件"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((f) => (
                <div
                  key={f.id}
                  className="overflow-hidden rounded-lg border border-subtle bg-surface-1 transition-transform hover:-translate-y-0.5"
                >
                  <FilePreviewThumb file={f} size="lg" />
                  <div className="p-2.5">
                    <div className="truncate text-12 font-medium text-primary">{f.name}</div>
                    <div className="mt-0.5 text-10 text-tertiary">
                      {f.sizeLabel} · {f.date}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1">
                      <FsTag tone="brand">{f.kind}</FsTag>
                      <FsTag>{stageLabel(f.stageId)}</FsTag>
                      <button
                        type="button"
                        onClick={() => openFile(f)}
                        className="ml-auto rounded-full p-1 text-tertiary hover:bg-layer-transparent-hover hover:text-primary"
                        aria-label="打开文件"
                      >
                        {f.mime.startsWith("image/") || f.mime === "application/pdf" ? (
                          <Eye className="size-3" strokeWidth={1.75} />
                        ) : (
                          <Download className="size-3" strokeWidth={1.75} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(f)}
                        className="rounded-full p-1 text-tertiary hover:bg-danger-subtle hover:text-danger-primary"
                        aria-label="删除文件"
                      >
                        <Trash2 className="size-3" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <FsMuted className="mt-3">
            5MB 内附件与元数据一并保存；标记「Portal 可见」的交付文件会进入业主安全链接。文件区为刻意无 AI 区。
          </FsMuted>

          {/* 上传归类弹窗 */}
          <FsModal
            open={!!pending}
            onClose={() => setPending(null)}
            title="归类后上传"
            footer={
              <>
                <FsButton variant="secondary" size="sm" onClick={() => setPending(null)}>
                  取消
                </FsButton>
                <FsButton size="sm" disabled={uploading} onClick={() => void confirmUpload()}>
                  {uploading ? "上传中…" : "保存文件"}
                </FsButton>
              </>
            }
          >
            <div className="space-y-3">
              <FsMuted>{pending?.name}</FsMuted>
              <FsField label="文件类型">
                <select
                  className={fsInputClass}
                  value={pendingKind}
                  onChange={(e) => setPendingKind(e.target.value as ProjectFileKind)}
                >
                  {FILE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </FsField>
              <FsField label="归属阶段">
                <select
                  className={fsInputClass}
                  value={pendingStage}
                  onChange={(e) => setPendingStage(e.target.value as StageId | "none")}
                >
                  <option value="none">未归阶段</option>
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </FsField>
              <label className="flex items-start gap-2 rounded-lg border border-subtle px-3 py-2.5 text-12">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-[var(--brand-default)]"
                  checked={pendingPortalVisible}
                  onChange={(event) => setPendingPortalVisible(event.target.checked)}
                />
                <span>
                  <span className="block font-medium text-primary">同步到业主 Portal</span>
                  <span className="mt-0.5 block text-11 text-tertiary">仅通过有效的安全分享链接可见</span>
                </span>
              </label>
            </div>
          </FsModal>

          <FsConfirm
            open={!!deleting}
            onCancel={() => setDeleting(null)}
            onConfirm={() => {
              if (deleting) {
                remove(deleting.id);
                setToast({ type: TOAST_TYPE.SUCCESS, title: "文件已删除", message: deleting.name });
              }
              setDeleting(null);
            }}
            title="删除文件？"
            body={deleting ? `「${deleting.name}」及其附件内容将从项目文件中移除。` : undefined}
            confirmLabel="删除"
            danger
          />
        </FsPageBody>
      </FsPageShell>
    </>
  );
}

function StageChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-11 font-medium transition-colors",
        active
          ? "border-accent-primary/40 bg-accent-subtle text-accent-primary"
          : "border-subtle bg-surface-1 text-secondary hover:bg-surface-2"
      )}
    >
      {label}
    </button>
  );
}

function FilePreviewThumb({ file, size }: { file: ProjectFile; size: "sm" | "lg" }) {
  const url = getFilePreviewUrl(file.id);
  const isImage = file.mime.startsWith("image/");
  const cls = size === "sm" ? "size-9 shrink-0 rounded-md" : "h-24 w-full";
  if (url && isImage) {
    return <img src={url} alt="" className={cn(cls, "object-cover")} />;
  }
  return (
    <div className={cn(cls, "flex items-center justify-center bg-surface-2 text-placeholder")}>
      {isImage ? (
        <ImageIcon className="size-4" strokeWidth={1.75} />
      ) : (
        <FileText className="size-4" strokeWidth={1.75} />
      )}
    </div>
  );
}
