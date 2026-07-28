/**
 * L1 App Rail — 与 Plane sidebar item 同套尺寸/hover，构境 logo 顶置
 */
"use client";

import { observer } from "mobx-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import useSWR from "swr";
import { ContextMenu } from "@plane/propel/context-menu";
import { CheckIcon, InboxIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
import markUrl from "@/app/assets/brand/mark.png?url";
import { AppSidebarItem } from "@/components/sidebar/sidebar-item";
import { HelpMenuRoot } from "@/components/workspace/sidebar/help-section/root";
import { AccountMenuRoot } from "@/components/workspace/sidebar/account-menu";
import { useWorkspaceNotifications } from "@/hooks/store/notifications";
import { useAppRailPreferences } from "@/hooks/use-navigation-preferences";
import { useAppRailVisibility } from "@/lib/app-rail/context";
import { AppSidebarItemsRoot } from "./items-root";

export const AppRailRoot = observer(() => {
  const { workspaceSlug } = useParams();
  const pathname = usePathname();
  const { preferences, updateDisplayMode } = useAppRailPreferences();
  const { isCollapsed, toggleAppRail } = useAppRailVisibility();
  const { unreadNotificationsCount, getUnreadNotificationsCount } = useWorkspaceNotifications();

  const showLabel = preferences.displayMode === "icon_with_label";
  const railWidth = showLabel ? "3.75rem" : "3rem";

  useSWR(
    workspaceSlug ? "WORKSPACE_UNREAD_NOTIFICATION_COUNT" : null,
    workspaceSlug ? () => getUnreadNotificationsCount(workspaceSlug.toString()) : null
  );

  const isMentionsEnabled = unreadNotificationsCount.mention_unread_notifications_count > 0;
  const totalNotifications = isMentionsEnabled
    ? unreadNotificationsCount.mention_unread_notifications_count
    : unreadNotificationsCount.total_unread_notifications_count;

  const isInboxActive = pathname?.includes("/notifications/");

  return (
    <div
      className="z-[26] h-full flex-shrink-0 bg-canvas transition-all duration-300 ease-in-out"
      style={{ width: railWidth }}
    >
      <ContextMenu>
        <ContextMenu.Trigger className="h-full">
          <div className="flex h-full flex-col px-2 py-2.5">
            {/* Logo：与 L1 图标格完全一致 size-8 rounded-md；下方间距加大（规范 v3 §8） */}
            <div className="mb-5 flex justify-center">
              <Tooltip tooltipContent="构境AI" position="right">
                <Link
                  href={workspaceSlug ? `/${workspaceSlug}/` : "/"}
                  className="flex size-8 items-center justify-center overflow-hidden rounded-md text-tertiary transition-colors hover:bg-layer-transparent-hover"
                  aria-label="构境AI formscape"
                >
                  <img src={markUrl} alt="构境AI" className="size-8 rounded-md object-cover" />
                </Link>
              </Tooltip>
            </div>

            <div
              className={cn("flex flex-1 flex-col", {
                "gap-4": showLabel,
                "gap-3": !showLabel,
              })}
            >
              <AppSidebarItemsRoot showLabel={showLabel} />
            </div>

            {/* 底部一组：同一 gap / 同一 AppSidebarItem size-8，帮助与账号垂直齐平 */}
            <div
              className={cn("mt-auto flex flex-col items-center border-t border-subtle pt-2.5", {
                "gap-3": true,
              })}
            >
              <Tooltip tooltipContent="收件箱" position="right">
                <div>
                  <AppSidebarItem
                    variant="link"
                    item={{
                      href: `/${workspaceSlug?.toString()}/notifications/`,
                      label: showLabel ? "收件" : undefined,
                      showLabel,
                      icon: (
                        <div className="relative">
                          <InboxIcon className="size-5" />
                          {totalNotifications > 0 && (
                            <span className="absolute top-0 right-0 size-1.5 rounded-full bg-danger-primary" />
                          )}
                        </div>
                      ),
                      isActive: isInboxActive,
                    }}
                  />
                </div>
              </Tooltip>

              <HelpMenuRoot />
              <AccountMenuRoot variant="rail" />
            </div>
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content positionerClassName="z-30" className="outline-none">
            <ContextMenu.Item onClick={() => updateDisplayMode("icon_only")}>
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-11">仅图标</span>
                {preferences.displayMode === "icon_only" && <CheckIcon className="size-3.5" />}
              </div>
            </ContextMenu.Item>
            <ContextMenu.Item onClick={() => updateDisplayMode("icon_with_label")}>
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-11">图标 + 文字</span>
                {preferences.displayMode === "icon_with_label" && <CheckIcon className="size-3.5" />}
              </div>
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item onClick={toggleAppRail}>
              <span className="text-11">{isCollapsed ? "固定侧栏" : "取消固定"}</span>
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu>
    </div>
  );
});
