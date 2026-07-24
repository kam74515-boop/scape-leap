/**
 * L2 顶区导航 — 构境 IA：首页 / 我的工作 / 草稿
 * （去掉 Plane 默认的 Workspace 折叠区 views/analytics 等）
 */
import React from "react";
import { observer } from "mobx-react";
import { WORKSPACE_SIDEBAR_STATIC_NAVIGATION_ITEMS } from "@plane/constants";
import { SidebarItemBase } from "./sidebar-item";

const FORMSCAPE_TOP_ITEMS = [
  WORKSPACE_SIDEBAR_STATIC_NAVIGATION_ITEMS["home"],
  WORKSPACE_SIDEBAR_STATIC_NAVIGATION_ITEMS["your-work"],
  WORKSPACE_SIDEBAR_STATIC_NAVIGATION_ITEMS["drafts"],
].filter(Boolean);

export const SidebarMenuItems = observer(function SidebarMenuItems() {
  return (
    <div className="flex flex-col gap-0.5">
      {FORMSCAPE_TOP_ITEMS.map((item) => (
        <SidebarItemBase key={item.key} item={item} />
      ))}
    </div>
  );
});
