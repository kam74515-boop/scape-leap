/**
 * L2 侧栏展开/收起 — 全站统一 lucide PanelLeft，收起后出现在主区顶栏左侧
 */
import { observer } from "mobx-react";
import { PanelLeft } from "@/icons";
import { IconButton } from "@plane/propel/icon-button";
import { useAppTheme } from "@/hooks/store/use-app-theme";

export const AppSidebarToggleButton = observer(function AppSidebarToggleButton() {
  const { toggleSidebar, sidebarPeek, toggleSidebarPeek, sidebarCollapsed } = useAppTheme();

  return (
    <IconButton
      size="xl"
      variant="ghost"
      icon={PanelLeft}
      aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
      onClick={() => {
        if (sidebarPeek) toggleSidebarPeek(false);
        toggleSidebar();
      }}
    />
  );
});
