import { Navigate } from "react-router";

/** 团队账号、席位和角色统一进入真实系统后台，避免维护两套成员数据。 */
function Page() {
  return <Navigate to="/admin?tab=users" replace />;
}

export default Page;
