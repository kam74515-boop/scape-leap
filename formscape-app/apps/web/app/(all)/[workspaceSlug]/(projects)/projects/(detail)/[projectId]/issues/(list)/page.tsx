/**
 * 项目默认落地：构境「任务」看板（非 Plane 空 Work items）
 */
import { observer } from "mobx-react";
import { PageHead } from "@/components/core/page-title";
import { FormscapeProjectTasksPage } from "@/components/formscape/ProjectTasksPage";
import { projectById } from "@/components/formscape/pm-mock";
import type { Route } from "./+types/page";

function ProjectIssuesPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const project = projectById(projectId);
  const pageTitle = project ? `${project.name} · 任务` : "任务";

  return (
    <>
      <PageHead title={pageTitle} />
      <FormscapeProjectTasksPage workspaceSlug={workspaceSlug} projectId={projectId} />
    </>
  );
}

export default observer(ProjectIssuesPage);
