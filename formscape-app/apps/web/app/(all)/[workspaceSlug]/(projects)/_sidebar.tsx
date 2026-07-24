/**
 * L2 侧栏宿主：按 L1 切换；项目 / 画布均为树形
 */
import { useState } from "react";
import { observer } from "mobx-react";
import { useParams, usePathname } from "next/navigation";
import { SIDEBAR_WIDTH } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { ResizableSidebar } from "@/components/sidebar/resizable-sidebar";
import { FormscapeL2ByModule } from "@/components/formscape/l2-sidebars";
import { getFormscapeL1 } from "@/components/formscape/l1-context";
import { useAppTheme } from "@/hooks/store/use-app-theme";

export const ProjectAppSidebar = observer(function ProjectAppSidebar() {
  const {
    sidebarCollapsed,
    toggleSidebar,
    sidebarPeek,
    toggleSidebarPeek,
    isExtendedSidebarOpened,
    isAnySidebarDropdownOpen,
  } = useAppTheme();
  const { storedValue, setValue } = useLocalStorage("sidebarWidth", SIDEBAR_WIDTH);
  const [sidebarWidth, setSidebarWidth] = useState<number>(storedValue ?? SIDEBAR_WIDTH);
  const { workspaceSlug } = useParams();
  const pathname = usePathname();

  const isNotificationsPath = pathname.includes(`/${workspaceSlug}/notifications`);
  const l1 = getFormscapeL1(pathname, workspaceSlug?.toString() ?? "");

  const handleWidthChange = (width: number) => setValue(width);

  if (isNotificationsPath) return null;

  /** 统一成布尔，避免 undefined 让 ResizableSidebar / 收起钮条件分叉 */
  const isCollapsed = sidebarCollapsed === true;

  return (
    <ResizableSidebar
      showPeek={!!sidebarPeek}
      defaultWidth={storedValue ?? 250}
      width={sidebarWidth}
      setWidth={setSidebarWidth}
      defaultCollapsed={isCollapsed}
      peekDuration={1500}
      onWidthChange={handleWidthChange}
      onCollapsedChange={(collapsed) => toggleSidebar(collapsed)}
      isCollapsed={isCollapsed}
      toggleCollapsed={() => toggleSidebar()}
      togglePeek={toggleSidebarPeek}
      isAnyExtendedSidebarExpanded={!!isExtendedSidebarOpened}
      isAnySidebarDropdownOpen={!!isAnySidebarDropdownOpen}
    >
      <FormscapeL2ByModule l1={l1} />
    </ResizableSidebar>
  );
});
