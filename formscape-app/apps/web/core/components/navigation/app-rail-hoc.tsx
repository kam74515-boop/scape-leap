/**
 * L1 App Rail 一级入口 — 构境工作区模块
 * 图标统一来自 @/icons（lucide）
 */
import React from "react";
import { observer } from "mobx-react";
import { useParams, usePathname } from "next/navigation";
import { L1Icons } from "@/icons";
import type { AppSidebarItemData } from "@/components/sidebar/sidebar-item";

type WithDockItemsProps = {
  dockItems: (AppSidebarItemData & { shouldRender: boolean })[];
};

export function withDockItems<P extends WithDockItemsProps>(WrappedComponent: React.ComponentType<P>) {
  const ComponentWithDockItems = observer(function ComponentWithDockItems(props: Omit<P, keyof WithDockItemsProps>) {
    const { workspaceSlug } = useParams();
    const pathname = usePathname();
    const ws = workspaceSlug?.toString() ?? "";

    const is = (seg: string) => pathname.includes(`/${ws}/${seg}`);
    const isHome =
      (pathname === `/${ws}` || pathname === `/${ws}/` || pathname.endsWith(`/${ws}`)) &&
      !is("canvas") &&
      !is("space") &&
      !is("customers") &&
      !is("library") &&
      !is("team") &&
      !is("users") &&
      !is("studio-settings") &&
      !is("notifications") &&
      !pathname.includes("/projects/");

    const ProjectsIcon = L1Icons.projects;
    const CanvasIcon = L1Icons.canvas;
    const SpaceIcon = L1Icons.space;
    const CustomersIcon = L1Icons.customers;
    const LibraryIcon = L1Icons.library;
    const UsersIcon = L1Icons.users;
    const SettingsIcon = L1Icons.settings;

    const dockItems: (AppSidebarItemData & { shouldRender: boolean })[] = [
      {
        label: "项目",
        icon: <ProjectsIcon className="size-5" strokeWidth={1.5} />,
        href: `/${ws}/`,
        isActive: isHome || pathname.includes(`/${ws}/projects`),
        shouldRender: true,
      },
      {
        label: "画布",
        icon: <CanvasIcon className="size-5" strokeWidth={1.5} />,
        href: `/${ws}/canvas`,
        isActive: is("canvas"),
        shouldRender: true,
      },
      {
        label: "3D模型",
        icon: <SpaceIcon className="size-5" strokeWidth={1.5} />,
        href: `/${ws}/space`,
        isActive: is("space"),
        shouldRender: true,
      },
      {
        label: "客户",
        icon: <CustomersIcon className="size-5" strokeWidth={1.5} />,
        href: `/${ws}/customers`,
        isActive: is("customers"),
        shouldRender: true,
      },
      {
        label: "生态库",
        icon: <LibraryIcon className="size-5" strokeWidth={1.5} />,
        href: `/${ws}/library`,
        isActive: is("library"),
        shouldRender: true,
      },
      {
        label: "用户管理",
        icon: <UsersIcon className="size-5" strokeWidth={1.5} />,
        href: `/${ws}/users`,
        isActive: is("users") || is("team"),
        shouldRender: true,
      },
      {
        label: "设置",
        icon: <SettingsIcon className="size-5" strokeWidth={1.5} />,
        href: `/${ws}/studio-settings`,
        isActive: is("studio-settings"),
        shouldRender: true,
      },
    ];

    return <WrappedComponent {...(props as P)} dockItems={dockItems} />;
  });

  return ComponentWithDockItems;
}
