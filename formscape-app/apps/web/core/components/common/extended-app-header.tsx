/**
 * 主区顶栏：左折叠（收起侧栏时）· 右 AI 入口
 * 项目内由 project layout 统一顶栏，此处不再重复
 */
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { FormscapeAiHeaderButton } from "@/components/formscape";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { useAppTheme } from "@/hooks/store/use-app-theme";

export const ExtendedAppHeader = observer(function ExtendedAppHeader(props: { header: ReactNode }) {
  const { header } = props;
  const { projectId } = useParams();
  const { sidebarCollapsed } = useAppTheme();

  const isProjectChrome = !!projectId;
  const showToggle = !!sidebarCollapsed && !isProjectChrome;

  return (
    <div className="flex w-full items-center gap-1.5">
      {showToggle && (
        <div className="flex shrink-0 items-center">
          <AppSidebarToggleButton />
        </div>
      )}
      <div className="min-w-0 flex-1">{header}</div>
      {!isProjectChrome && (
        <div className="flex shrink-0 items-center">
          <FormscapeAiHeaderButton />
        </div>
      )}
    </div>
  );
});
