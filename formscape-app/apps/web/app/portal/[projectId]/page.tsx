/**
 * 业主 Client Portal 路由（独立入口，不进主 App 壳 / 不挂 L1、L2 导航）
 */
import { useParams } from "react-router";
import { FormscapeClientPortalPage } from "@/components/formscape/ClientPortalPage";

export default function Page() {
  const { projectId, token } = useParams();
  if (!projectId || !token) return null;
  return <FormscapeClientPortalPage projectId={projectId} token={token} />;
}
