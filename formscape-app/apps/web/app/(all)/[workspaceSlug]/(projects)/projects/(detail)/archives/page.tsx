import { Navigate, useParams } from "react-router";

/** 产品不再暴露 Plane 项目归档页，旧书签统一回到构境项目驾驶舱。 */
export default function ProjectArchivesRedirect() {
  const { workspaceSlug } = useParams();
  return <Navigate to={`/${workspaceSlug ?? "formscape"}/`} replace />;
}
