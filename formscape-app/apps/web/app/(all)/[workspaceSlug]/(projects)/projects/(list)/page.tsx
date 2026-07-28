import { Navigate, useParams } from "react-router";

/** 旧 Plane 项目列表入口统一回到构境项目驾驶舱。 */
export default function ProjectsRedirect() {
  const { workspaceSlug } = useParams();
  return <Navigate to={`/${workspaceSlug ?? "formscape"}/`} replace />;
}
