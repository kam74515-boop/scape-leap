import { Navigate, useParams } from "react-router";

/** 旧 Plane work-item 深链统一收口到构境项目任务页。 */
export default function IssueDetailsRedirect() {
  const { workspaceSlug, projectId } = useParams();
  return (
    <Navigate
      to={`/${workspaceSlug ?? "formscape"}/projects/${projectId ?? ""}/issues`}
      replace
    />
  );
}
