import { PageHead } from "@/components/core/page-title";
import { WORKSPACE_META } from "./workspace-mock";
import { FsCard, FsCardTitle, FsMuted, FsPageBody, FsPageHeader, FsPageShell, FsPrimaryLink, FsTag } from "./ui";

export function FormscapeWorkspaceSettingsPage() {
  return (
    <>
      <PageHead title="工作室设置 · 构境AI" />
      <FsPageShell>
        <FsPageHeader title="设置" description="计划 · 算力 · 集成 · 外观" />
        <FsPageBody>
          <div className="w-full max-w-3xl space-y-3">
            <FsCard>
              <div className="flex items-center justify-between">
                <FsCardTitle>订阅计划</FsCardTitle>
                <FsTag>{WORKSPACE_META.plan}</FsTag>
              </div>
              <FsMuted className="mt-1">
                席位 {WORKSPACE_META.seatsUsed}/{WORKSPACE_META.seatsTotal} · Studio 含全流程 + PPT + 生态库
              </FsMuted>
              <div className="mt-3">
                <FsPrimaryLink to="#">升级 Business</FsPrimaryLink>
              </div>
            </FsCard>
            <FsCard>
              <FsCardTitle>集成</FsCardTitle>
              <div className="mt-2 space-y-2 text-13 text-secondary">
                <div className="flex justify-between border-b border-subtle py-2">
                  <span>SketchUp / Rhino 插件</span>
                  <span className="text-11 text-tertiary">即将推出</span>
                </div>
                <div className="flex justify-between border-b border-subtle py-2">
                  <span>飞书</span>
                  <span className="text-11 text-tertiary">未连接</span>
                </div>
                <div className="flex justify-between py-2">
                  <span>材料联盟 SKU</span>
                  <span className="text-11 text-tertiary">Demo</span>
                </div>
              </div>
            </FsCard>
            <FsCard>
              <FsCardTitle>外观</FsCardTitle>
              <FsMuted>跟随系统 / 浅色 / 深色 — 使用顶栏主题偏好（Plane 原生）</FsMuted>
            </FsCard>
          </div>
        </FsPageBody>
      </FsPageShell>
    </>
  );
}
