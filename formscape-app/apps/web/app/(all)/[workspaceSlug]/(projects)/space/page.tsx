import { observer } from "mobx-react";
import { useParams } from "react-router";
import { FormscapeSpaceModelPage } from "@/components/formscape/SpaceModelPage";

function Page() {
  const { workspaceSlug } = useParams();
  if (!workspaceSlug) return null;
  return <FormscapeSpaceModelPage workspaceSlug={workspaceSlug} />;
}

export default observer(Page);

