/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { Header, Row } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import { AppHeader } from "@/components/core/app-header";
import { TabNavigationRoot } from "@/components/navigation";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProjectNavigationPreferences } from "@/hooks/use-navigation-preferences";
// local components
import { WorkItemDetailsHeader } from "./work-item-header";

export const ProjectWorkItemDetailsHeader = observer(function ProjectWorkItemDetailsHeader() {
  // router
  const { workspaceSlug, workItem } = useParams();
  // store hooks
  const { sidebarCollapsed } = useAppTheme();
  const {
    issue: { getIssueById, getIssueIdByIdentifier },
  } = useIssueDetail();
  // derived values
  const issueId = getIssueIdByIdentifier(workItem?.toString());
  const issueDetails = issueId ? getIssueById(issueId?.toString()) : undefined;
  // preferences
  const { preferences: projectPreferences } = useProjectNavigationPreferences();

  return (
    <>
      {projectPreferences.navigationMode === "TABBED" && (
        <div className="z-20">
          <Row className="flex h-11 w-full items-center gap-1.5 border-b border-subtle bg-surface-1">
            {sidebarCollapsed === true && (
              <div className="flex shrink-0 items-center">
                <AppSidebarToggleButton />
              </div>
            )}
            <Header
              className={cn("h-full min-w-0 flex-1", {
                "pl-0": sidebarCollapsed === true,
                "pl-1.5": sidebarCollapsed !== true,
              })}
            >
              <Header.LeftItem className="h-full max-w-full">
                <TabNavigationRoot
                  workspaceSlug={workspaceSlug}
                  projectId={issueDetails?.project_id?.toString() ?? ""}
                />
              </Header.LeftItem>
            </Header>
          </Row>
        </div>
      )}
      <AppHeader header={<WorkItemDetailsHeader />} />
    </>
  );
});
