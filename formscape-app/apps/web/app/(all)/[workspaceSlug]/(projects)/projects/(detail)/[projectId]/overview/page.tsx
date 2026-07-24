import { observer } from "mobx-react";
import { useParams } from "react-router";
import { FormscapeOverviewPage } from "@/components/formscape";

function ProjectOverviewPage() {
  const { workspaceSlug, projectId } = useParams();
  if (!workspaceSlug || !projectId) return null;
  return <FormscapeOverviewPage workspaceSlug={workspaceSlug} projectId={projectId} />;
}

export default observer(ProjectOverviewPage);
