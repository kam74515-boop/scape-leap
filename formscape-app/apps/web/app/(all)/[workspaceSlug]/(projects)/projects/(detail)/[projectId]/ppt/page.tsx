import { observer } from "mobx-react";
import { useParams } from "react-router";
import { FormscapePptPage } from "@/components/formscape";

function Page() {
  const { workspaceSlug, projectId } = useParams();
  if (!workspaceSlug || !projectId) return null;
  return <FormscapePptPage workspaceSlug={workspaceSlug} projectId={projectId} />;
}
export default observer(Page);
