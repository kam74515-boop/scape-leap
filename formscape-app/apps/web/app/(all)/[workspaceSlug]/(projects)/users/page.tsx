import { observer } from "mobx-react";
import { FormscapeTeamPage } from "@/components/formscape";

/** L1 团队管理（成员 / 席位 / 角色） */
function Page() {
  return <FormscapeTeamPage />;
}

export default observer(Page);
