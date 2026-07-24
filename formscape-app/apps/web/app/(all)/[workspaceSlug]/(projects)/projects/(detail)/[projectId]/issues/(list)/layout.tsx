/**
 * 任务页：不再套 Plane AppHeader，避免与项目顶栏 / 页内标题双栏
 */
import { Outlet } from "react-router";
import { ContentWrapper } from "@/components/core/content-wrapper";

export default function ProjectIssuesLayout() {
  return (
    <ContentWrapper>
      <Outlet />
    </ContentWrapper>
  );
}
