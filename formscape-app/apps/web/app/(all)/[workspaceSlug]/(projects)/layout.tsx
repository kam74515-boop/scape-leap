/**
 * L2 壳：侧栏 | 主内容 | AI Agent（右侧停靠）
 */
import { observer } from "mobx-react";
import { Outlet } from "react-router";
import { FormscapeAiPanel, FormscapeAiProvider } from "@/components/formscape";
import { CanvasLibraryProvider } from "@/components/formscape/canvas/canvas-library-context";
import { ProjectsAppPowerKProvider } from "@/components/power-k/projects-app-provider";
import { ProjectAppSidebar } from "./_sidebar";
import { ExtendedProjectSidebar } from "./extended-project-sidebar";

function WorkspaceLayout() {
  return (
    <FormscapeAiProvider>
      <CanvasLibraryProvider>
        <ProjectsAppPowerKProvider />
        <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden overscroll-none rounded-lg border border-subtle bg-surface-1">
          <div id="full-screen-portal" className="pointer-events-none absolute inset-0 z-0 w-full" />
          <div className="relative flex min-h-0 w-full flex-1 overflow-hidden">
            <ProjectAppSidebar />
            <ExtendedProjectSidebar />
            <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overscroll-none bg-surface-1">
              <Outlet />
            </main>
            {/* Agent 集成在 L2 壳右侧 */}
            <FormscapeAiPanel />
          </div>
        </div>
      </CanvasLibraryProvider>
    </FormscapeAiProvider>
  );
}

export default observer(WorkspaceLayout);
