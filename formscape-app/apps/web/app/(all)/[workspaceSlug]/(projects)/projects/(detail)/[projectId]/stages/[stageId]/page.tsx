import { observer } from "mobx-react";
import { useParams } from "react-router";
import { FormscapeStagesPage } from "@/components/formscape";

function ProjectStagePage() {
  const { workspaceSlug, projectId, stageId } = useParams();
  if (!workspaceSlug || !projectId || !stageId) return null;
  return <FormscapeStagesPage workspaceSlug={workspaceSlug} projectId={projectId} stageId={stageId} />;
}

export default observer(ProjectStagePage);
