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
import { findCanvasMeta } from "./canvas-mock";

/** 懒加载：@xyflow/react + 节点类型 + 样式，仅进入画布页才拉取 */
const CanvasWorkspace = lazy(function loadCanvasWorkspace() {
  return import("./canvas/CanvasWorkspace").then((m) => ({ default: m.CanvasWorkspace }));
});

type Props = {
  workspaceSlug: string;
};

/**
 * L1 意向画布 — L2 为项目→子画布树；主区随 query 显示当前板
 */
export const FormscapeCanvasPage = observer(function FormscapeCanvasPage({ workspaceSlug }: Props) {
  const { project } = useFormscapeProject();
  const { sidebarCollapsed } = useAppTheme();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const boardId = searchParams.get("board");

  const meta = useMemo(() => findCanvasMeta(projectId, boardId), [projectId, boardId]);
  const title = meta?.board?.name ?? "意向画布";
  const subtitle = meta
    ? `${meta.project.emoji} ${meta.project.projectName} · ${meta.project.stageLabel}`
    : `绑定「${project.name}」· 风格 / 渲染 / 技能汇入`;
  const stageHref = meta
    ? `/${workspaceSlug}/projects/${meta.project.projectId}/stages/style`
    : `/${workspaceSlug}/projects/${project.id}/stages/style`;

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
          <Suspense fallback={<CanvasWorkspaceSkeleton />}>
            <CanvasWorkspace project={project} />
          </Suspense>
        </div>
      </FsPageShell>
    </>
  );
});
