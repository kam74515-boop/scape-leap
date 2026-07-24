import { observer } from "mobx-react";
import { useParams } from "react-router";
import { FormscapeCustomersPage } from "@/components/formscape";

function Page() {
  const { workspaceSlug } = useParams();
  if (!workspaceSlug) return null;
  return <FormscapeCustomersPage workspaceSlug={workspaceSlug} />;
}
export default observer(Page);
