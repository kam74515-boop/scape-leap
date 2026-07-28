/**
 * 构境项目守卫 — 取代 Plane ProjectAuthWrapper（去 Plane 影子）。
 * Plane 版会向已下线的 API(:8000) 发十余个 SWR 请求，失败即渲染
 * Plane 空态「Project not found」。构境为前端-only demo：项目真源 =
 * pm-mock 目录，命中即渲染子页面，未命中显示构境 FsEmpty 空态。
 */
import type { ReactNode } from "react";
import { getProjectById, useProjects } from "./projects-store";
import { FsEmpty, FsPrimaryLink } from "./ui";

export function FormscapeProjectGuard({
  workspaceSlug,
  projectId,
  children,
}: {
  workspaceSlug: string;
  projectId: string;
  children: ReactNode;
}) {
  const { ready } = useProjects();
  const project = getProjectById(projectId);
  if (!ready && !project) {
    return <div className="grid h-full w-full place-items-center text-12 text-tertiary">正在载入项目…</div>;
  }
  if (!project) {
    return (
      <div className="grid h-full w-full place-items-center bg-surface-1 p-6">
        <FsEmpty
          className="max-w-md"
          title="项目不存在或已移除"
          body="这个项目不在当前工作室里，可能已被移除。回到仪表盘继续推进在手项目。"
          action={<FsPrimaryLink to={`/${workspaceSlug}/`}>回到工作室仪表盘</FsPrimaryLink>}
        />
      </div>
    );
  }
  return <>{children}</>;
}
