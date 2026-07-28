import { Navigate, useParams } from "react-router";

/** 兼容旧链接 /:ws/team → 客户端重定向到 /:ws/users（团队管理）。
 *  SPA 模式下不可用 loader 重定向（invalid route export），故用 Navigate。 */
export default function TeamRedirect() {
  const { workspaceSlug } = useParams();
  return <Navigate to={`/${workspaceSlug ?? "formscape"}/users`} replace />;
}
