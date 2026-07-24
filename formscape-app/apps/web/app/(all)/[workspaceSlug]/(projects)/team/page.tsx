import { observer } from "mobx-react";
import { FormscapeTeamPage } from "@/components/formscape";

/** @deprecated 路径兼容：请使用 /users */
function Page() {
  return <FormscapeTeamPage />;
}

export default observer(Page);
