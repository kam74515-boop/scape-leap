/**
 * 工作区首页 → 构境「项目管理仪表盘」
 */
import { observer } from "mobx-react";
import { FormscapeProjectsDashboard } from "@/components/formscape/ProjectsDashboard";

export const WorkspaceHomeView = observer(function WorkspaceHomeView() {
  return <FormscapeProjectsDashboard />;
});
