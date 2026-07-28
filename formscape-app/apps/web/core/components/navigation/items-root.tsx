/**
 * L1 App Rail 模块图标列 — 仅被 app-rail-root 使用
 * 选中态：brand 软色块（浅底深字）+ 左侧 3px 圆角指示条（设计规范 v3 §8）
 * 恢复到「继续完善 UI 设计」之前的另一 AI 改版样式
 */

import React from "react";
import Link from "next/link";
import { cn } from "@plane/utils";
import type { AppSidebarItemData } from "@/components/sidebar/sidebar-item";
import { withDockItems } from "./app-rail-hoc";

type Props = {
  dockItems: (AppSidebarItemData & { shouldRender: boolean })[];
  showLabel?: boolean;
};

function RailItem({ item, showLabel }: { item: AppSidebarItemData; showLabel: boolean }) {
  if (!item.href) return null;
  const active = !!item.isActive;
  return (
    <Link
      href={item.href}
      className="group relative flex flex-col items-center justify-center gap-0.5"
      aria-current={active ? "page" : undefined}
    >
      {active && (
        <span
          aria-hidden
          className="absolute -left-2 top-1 h-6 w-[3px] rounded-r-full bg-accent-primary"
        />
      )}
      <div
        className={cn(
          "flex size-8 items-center justify-center rounded-md transition-colors",
          active
            ? "bg-accent-subtle text-accent-primary"
            : "text-icon-tertiary group-hover:bg-layer-transparent-hover group-hover:text-icon-secondary"
        )}
      >
        {item.icon}
      </div>
      {showLabel && item.label && (
        <span
          className={cn(
            "text-11 font-medium",
            active ? "text-accent-secondary" : "text-tertiary group-hover:text-secondary"
          )}
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

function Component({ dockItems, showLabel = true }: Props) {
  return (
    <>
      {dockItems
        .filter((item) => item.shouldRender)
        .map((item) => (
          <RailItem key={item.label} item={item} showLabel={showLabel} />
        ))}
    </>
  );
}

export const AppSidebarItemsRoot = withDockItems(Component);
