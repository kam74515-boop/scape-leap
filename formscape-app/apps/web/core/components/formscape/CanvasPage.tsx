import { lazy, Suspense, useMemo } from "react";
import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
import { PageHead } from "@/components/core/page-title";
import { CanvasWorkspaceSkeleton } from "./canvas/CanvasWorkspaceSkeleton";
import { FsPageShell, FsSecondaryLink } from "./ui";
import { useFormscapeProject } from "./use-formscape-project";
import { FormscapeAiHeaderButton } from "./AiDrawer";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { canvasDefaultBoardId, findCanvasMeta } from "./canvas-mock";
import type { FormscapeProject } from "./types";

/** 懒加载：@xyflow/react + 节点类型 + 样式，仅进入画布页才拉取 */
const CanvasWorkspace = lazy(function loadCanvasWorkspace() {
  return import("./canvas/CanvasWorkspace").then((m) => ({ default: m.CanvasWorkspace }));
});

type Props = {
  workspaceSlug: string;
};

/**
 * L1 意向画布 — L2 为项目→子画布树；主区随 query 显示当前板
 * 每个 board 是独立新画布（独立 localStorage 文档）
 */
export const FormscapeCanvasPage = observer(function FormscapeCanvasPage({ workspaceSlug }: Props) {
  const { sidebarCollapsed } = useAppTheme();
  const searchParams = useSearchParams();
  const requestedProjectId = searchParams.get("project") ?? undefined;
  const { project: boundProject } = useFormscapeProject(requestedProjectId);
  const projectId = requestedProjectId ?? boundProject.id;
  const requestedBoardId = searchParams.get("board");

  const meta = useMemo(
    () => findCanvasMeta(projectId, requestedBoardId),
    [projectId, requestedBoardId]
  );
  const boardId = meta?.board?.id ?? canvasDefaultBoardId(projectId);
  const title = meta?.board?.name ?? "意向画布";
  const subtitle = meta
    ? `${meta.project.projectName} · ${meta.project.stageLabel}`
    : `绑定「${boundProject.name}」· 独立子画布`;
  const stageHref = meta
    ? `/${workspaceSlug}/projects/${meta.project.projectId}/stages/style`
    : `/${workspaceSlug}/projects/${boundProject.id}/stages/style`;

  /** 工作区 project 数据：沿用 mock 项目字段，id 对齐 URL 项目 */
  const canvasProject: FormscapeProject = useMemo(
    () => ({
      ...boundProject,
      id: projectId,
      name: meta?.project.projectName ?? boundProject.name,
    }),
    [boundProject, projectId, meta?.project.projectName]
  );

  // 切换子画布时强制 remount，避免节点状态串板 / 卡在加载壳
  const workspaceKey = `${projectId}::${boardId}`;

  return (
    <>
      <PageHead title={`${title} · 构境AI`} />
      <FsPageShell>
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-subtle bg-surface-1 px-3">
          <div className="flex min-w-0 items-center gap-1.5">
            {sidebarCollapsed === true && <AppSidebarToggleButton />}
            <div className="min-w-0">
              <div className="truncate text-13 font-semibold text-primary">{title}</div>
              <div className="truncate text-11 text-tertiary">{subtitle}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <FsSecondaryLink to={stageHref}>去风格阶段</FsSecondaryLink>
            <FormscapeAiHeaderButton />
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <Suspense fallback={<CanvasWorkspaceSkeleton />} key={workspaceKey}>
            <CanvasWorkspace
              key={workspaceKey}
              project={canvasProject}
              boardId={boardId}
              boardName={title}
            />
          </Suspense>
        </div>
      </FsPageShell>
    </>
  );
});
