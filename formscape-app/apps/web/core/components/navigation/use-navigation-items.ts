/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useCallback } from "react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import type { EUserProjectRoles, IPartialProject } from "@plane/types";
import type { TNavigationItem } from "@/components/navigation/tab-navigation-root";
import { ProjectNavIcons } from "@/icons";

type UseNavigationItemsProps = {
  workspaceSlug: string;
  projectId: string;
  project?: IPartialProject;
  allowPermissions: (
    access: EUserPermissions[] | EUserProjectRoles[],
    level: EUserPermissionsLevel,
    workspaceSlug: string,
    projectId: string
  ) => boolean;
};

export const useNavigationItems = ({
  workspaceSlug,
  projectId,
  project,
  allowPermissions,
}: UseNavigationItemsProps): TNavigationItem[] => {
  // L2/L3 项目导航 — 构境产品
  const baseNavigation = useCallback(
    // oxlint-disable-next-line no-shadow
    (workspaceSlug: string, projectId: string): TNavigationItem[] => [
      {
        i18n_key: "概览",
        key: "overview",
        name: "概览",
        href: `/${workspaceSlug}/projects/${projectId}/overview`,
        icon: ProjectNavIcons.overview,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
        shouldRender: true,
        sortOrder: 0,
      },
      {
        i18n_key: "设计阶段",
        key: "stages",
        name: "设计阶段",
        href: `/${workspaceSlug}/projects/${projectId}/stages/requirements`,
        icon: ProjectNavIcons.stages,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
        shouldRender: true,
        sortOrder: 1,
      },
      {
        i18n_key: "任务",
        key: "work_items",
        name: "任务",
        href: `/${workspaceSlug}/projects/${projectId}/issues`,
        icon: ProjectNavIcons.tasks,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
        shouldRender: true,
        sortOrder: 2,
      },
      {
        i18n_key: "汇报 PPT",
        key: "ppt",
        name: "汇报 PPT",
        href: `/${workspaceSlug}/projects/${projectId}/ppt`,
        icon: ProjectNavIcons.ppt,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
        shouldRender: true,
        sortOrder: 3,
      },
      {
        i18n_key: "文件",
        key: "files",
        name: "文件",
        href: `/${workspaceSlug}/projects/${projectId}/files`,
        icon: ProjectNavIcons.files,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
        shouldRender: true,
        sortOrder: 4,
      },
    ],
    [project]
  );

  // Combine, filter, and sort navigation items
  const navigationItems = useMemo(() => {
    const navItems = baseNavigation(workspaceSlug, projectId);

    // Filter by permissions and shouldRender
    const filteredItems = navItems.filter((item) => {
      if (!item.shouldRender) return false;
      const hasAccess = allowPermissions(item.access, EUserPermissionsLevel.PROJECT, workspaceSlug, project?.id ?? "");
      return hasAccess;
    });

    // Sort by sortOrder
    // oxlint-disable-next-line unicorn/no-array-sort
    return filteredItems.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [workspaceSlug, projectId, baseNavigation, allowPermissions, project?.id]);

  return navigationItems;
};
