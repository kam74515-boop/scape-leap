/**
 * 构境产品扩展路由 — L1 工作区模块 + L3 项目交付
 */
import { layout, route } from "@react-router/dev/routes";
import type { RouteConfigEntry } from "@react-router/dev/routes";

export const extendedRoutes: RouteConfigEntry[] = [
  // 业主 Client Portal：业主唯一触点，独立于工作台壳（无 L1/L2 导航、无登录墙）
  route("portal/:projectId/:token", "./portal/[projectId]/page.tsx"),
  layout("./(all)/layout.tsx", [
    layout("./(all)/[workspaceSlug]/layout.tsx", [
      layout("./(all)/[workspaceSlug]/(projects)/layout.tsx", [
        // L1 工作区
        route(":workspaceSlug/canvas", "./(all)/[workspaceSlug]/(projects)/canvas/page.tsx"),
        route(":workspaceSlug/space", "./(all)/[workspaceSlug]/(projects)/space/page.tsx"),
        route(":workspaceSlug/customers", "./(all)/[workspaceSlug]/(projects)/customers/page.tsx"),
        route(":workspaceSlug/library", "./(all)/[workspaceSlug]/(projects)/library/page.tsx"),
        route(":workspaceSlug/users", "./(all)/[workspaceSlug]/(projects)/users/page.tsx"),
        // 兼容旧链接 /team → loader 重定向到 /users（同文件别名会导致 route id 冲突，故独立文件）
        route(":workspaceSlug/team", "./(all)/[workspaceSlug]/(projects)/team/page.tsx"),
        route(":workspaceSlug/studio-settings", "./(all)/[workspaceSlug]/(projects)/formscape-settings/page.tsx"),

        // L3 项目
        layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/layout.tsx", [
          route(
            ":workspaceSlug/projects/:projectId/overview",
            "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/overview/page.tsx"
          ),
          route(
            ":workspaceSlug/projects/:projectId/stages/:stageId",
            "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/stages/[stageId]/page.tsx"
          ),
          route(
            ":workspaceSlug/projects/:projectId/ppt",
            "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/ppt/page.tsx"
          ),
          route(
            ":workspaceSlug/projects/:projectId/files",
            "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/files/page.tsx"
          ),
        ]),
      ]),
    ]),
  ]),
];
