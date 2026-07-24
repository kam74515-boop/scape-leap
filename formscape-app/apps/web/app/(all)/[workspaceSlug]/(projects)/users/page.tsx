import { observer } from "mobx-react";
import { FormscapeTeamPage } from "@/components/formscape";

/** L1 用户管理（含原团队成员 / 席位 / 角色） */
function Page() {
  return <FormscapeTeamPage />;
}

export default observer(Page);
