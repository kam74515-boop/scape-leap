/**
 * 项目内 layout — 不再有顶栏 Tab（导航全在 L2 树）
 * 仅保留：侧栏折叠钮（收起时）+ AI
 */
import { observer } from "mobx-react";
import { Outlet } from "react-router";
import { Row } from "@plane/ui";
import { FormscapeAiHeaderButton } from "@/components/formscape";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { ProjectAuthWrapper } from "@/layouts/auth-layout/project-wrapper";
import type { Route } from "./+types/layout";

function ProjectLayout({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const { sidebarCollapsed } = useAppTheme();

  return (
    <>
      {/* 轻顶栏：无 Tab，仅折叠 + AI；侧栏展开时可不显示折叠钮 */}
      <div className="z-20">
        <Row className="flex h-11 w-full items-center justify-end gap-1.5 border-b border-subtle bg-surface-1 px-2">
          {sidebarCollapsed === true && (
            <div className="mr-auto flex shrink-0 items-center">
              <AppSidebarToggleButton />
            </div>
          )}
          <FormscapeAiHeaderButton />
        </Row>
      </div>
      <ProjectAuthWrapper workspaceSlug={workspaceSlug} projectId={projectId}>
        <Outlet />
      </ProjectAuthWrapper>
    </>
  );
}

export default observer(ProjectLayout);
