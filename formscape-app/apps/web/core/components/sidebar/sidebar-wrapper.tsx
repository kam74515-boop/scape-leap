/**
 * L2 侧栏：顶栏 h-11 与主区 AppHeader /「首页」面包屑齐平
 */
import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useOutsideClickDetector } from "@plane/hooks";
import { SlidersHorizontal } from "@/icons";
import { ScrollArea } from "@plane/propel/scrollarea";
import { CustomizeNavigationDialog } from "@/components/navigation/customize-navigation-dialog";
import { WorkspaceEditionBadge } from "@/components/workspace/edition-badge";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import useSize from "@/hooks/use-window-size";
import { AppSidebarToggleButton } from "./sidebar-toggle-button";
import { IconButton } from "@plane/propel/icon-button";

type TSidebarWrapperProps = {
  title: string;
  children: React.ReactNode;
  quickActions?: React.ReactNode;
};

export const SidebarWrapper = observer(function SidebarWrapper(props: TSidebarWrapperProps) {
  const { title, children, quickActions } = props;
  const [isCustomizeNavDialogOpen, setIsCustomizeNavDialogOpen] = useState(false);
  const { toggleSidebar, sidebarCollapsed } = useAppTheme();
  const windowSize = useSize();
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClickDetector(ref, () => {
    if (sidebarCollapsed !== true && window.innerWidth < 768) {
      toggleSidebar(true);
    }
  });

  useEffect(() => {
    if (windowSize[0] < 768 && sidebarCollapsed !== true) toggleSidebar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowSize]);

  return (
    <>
      <CustomizeNavigationDialog isOpen={isCustomizeNavDialogOpen} onClose={() => setIsCustomizeNavDialogOpen(false)} />
      <div ref={ref} className="flex h-full min-h-0 w-full animate-fade-in flex-col bg-surface-1">
        {/*
          与主区 AppHeader 同构：h-11 + border-b + items-center
          工具按钮与右侧「首页」面包屑垂直齐平
        */}
        {/* h-11 与主区顶栏齐平；按钮 size-xl(=size-8) 与 L1 帮助/账号格子齐平 */}
        <div className="flex h-11 shrink-0 items-center justify-between gap-1 border-b border-subtle px-3">
          <span className="truncate text-13 font-semibold text-primary">{title}</span>
          <div className="flex shrink-0 items-center gap-0.5">
            {(title === "Projects" || title === "项目") && (
              <IconButton
                size="xl"
                variant="ghost"
                icon={SlidersHorizontal}
                aria-label="自定义导航"
                onClick={() => setIsCustomizeNavDialogOpen(true)}
              />
            )}
            {/* 展开态：折叠钮在 L2 顶栏；收起后改在主区顶栏（sidebarCollapsed === true） */}
            {sidebarCollapsed !== true && <AppSidebarToggleButton />}
          </div>
        </div>

        {quickActions && <div className="shrink-0 px-3 pt-2">{quickActions}</div>}

        <ScrollArea
          orientation="vertical"
          scrollType="hover"
          size="sm"
          rootClassName="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
          viewportClassName="flex h-full w-full flex-col gap-2 overflow-x-hidden overflow-y-auto px-2 py-2"
        >
          {children}
        </ScrollArea>

        <div className="flex h-11 shrink-0 items-center border-t border-subtle px-3">
          <WorkspaceEditionBadge />
        </div>
      </div>
    </>
  );
});
