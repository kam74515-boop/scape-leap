/**
 * 首页 = 项目管理仪表盘（设计工作室在手项目）
 * 与 Plane Home widgets 完全不同：KPI + 项目卡片 + 分配 + 设计费
 */
import { Link } from "react-router";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  FileEdit,
  FolderKanban,
  ListTodo,
  MapPin,
  Users,
} from "@/icons";
import { cn } from "@plane/utils";
import { useMemo } from "react";
import { DASHBOARD_KPI, MY_ASSIGNMENTS, PM_PROJECTS, PRIORITY_LABEL } from "./pm-mock";
import { getStudioBizSnapshots, type BizNodeStatus } from "./project-progress-store";
import { useStudioProgressTick } from "./use-project-progress";
import { FsCard, FsCardTitle, FsMuted, FsTag } from "./ui";

const RISK_CLASS: Record<string, string> = {
  正常: "bg-surface-2 text-secondary",
  关注: "bg-accent-subtle text-accent-primary",
  延期: "bg-danger-subtle text-danger-primary",
};

const BIZ_NODE_CLASS: Record<BizNodeStatus, string> = {
  done: "border-transparent bg-surface-2 text-secondary",
  current: "border-accent-primary/40 bg-accent-subtle text-accent-primary",
  todo: "border-subtle bg-surface-1 text-placeholder",
  blocked: "border-danger-subtle bg-danger-subtle text-danger-primary",
};

export function FormscapeProjectsDashboard() {
  const { workspaceSlug } = useParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const myOpen = MY_ASSIGNMENTS.filter((a) => a.state !== "done").slice(0, 6);
  const progressTick = useStudioProgressTick();
  const studioSnaps = useMemo(() => {
    void progressTick;
    return getStudioBizSnapshots();
  }, [progressTick]);
  const snapById = useMemo(
    () => Object.fromEntries(studioSnaps.map((s) => [s.projectId, s])),
    [studioSnaps]
  );
  const feePending = useMemo(
    () => Number(studioSnaps.reduce((s, x) => s + x.fee.pendingWan, 0).toFixed(1)),
    [studioSnaps]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-surface-2">
      <div className="mx-auto w-full max-w-[1200px] space-y-4 px-3 py-4 md:px-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-11 font-medium text-accent-primary">构境 · 项目管理</div>
            <h1 className="mt-0.5 text-18 font-semibold text-primary">工作室仪表盘</h1>
            <FsMuted className="mt-0.5">在手项目 · 经营节点 · 任务负荷 · 设计费 — Demo 数据</FsMuted>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/${ws}/profile/user-local-1`}
              className="inline-flex items-center gap-1 rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-11 font-medium text-secondary hover:bg-surface-2"
            >
              我的工作 <ArrowRight className="size-3" />
            </Link>
            <Link
              to={`/${ws}/drafts`}
              className="inline-flex items-center gap-1 rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-11 font-medium text-secondary hover:bg-surface-2"
            >
              草稿箱 <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi icon={<FolderKanban className="size-4" />} label="在手项目" value={String(DASHBOARD_KPI.activeProjects)} />
          <Kpi
            icon={<ListTodo className="size-4" />}
            label="我的待办"
            value={String(DASHBOARD_KPI.myOpenTasks)}
            href={`/${ws}/profile/user-local-1`}
          />
          <Kpi
            icon={<AlertTriangle className="size-4" />}
            label="今日/紧急"
            value={String(DASHBOARD_KPI.overdue)}
            tone="warn"
            href={`/${ws}/profile/user-local-1`}
          />
          <Kpi
            icon={<FileEdit className="size-4" />}
            label="工作项草稿"
            value={String(DASHBOARD_KPI.drafts)}
            href={`/${ws}/drafts`}
          />
          <Kpi icon={<Banknote className="size-4" />} label="设计费待收(万)" value={String(feePending)} />
        </div>

        {/* 经营节点：工作室仪表盘 · 不做 L2 第三级 */}
        <FsCard className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle px-4 py-3">
            <div>
              <FsCardTitle>经营节点</FsCardTitle>
              <FsMuted>工作室汇总 · 与设计费同源 · 单项目见概览</FsMuted>
            </div>
            <span className="text-11 text-tertiary">待收设计费合计 {feePending} 万</span>
          </div>
          <ul className="divide-y divide-subtle">
            {studioSnaps.map((snap) => (
              <li key={snap.projectId} className="px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to={`/${ws}/projects/${snap.projectId}/overview`}
                    className="text-13 font-medium text-primary hover:text-accent-primary"
                  >
                    {snap.projectName}
                  </Link>
                  <span className="text-11 text-tertiary">
                    当前 · {snap.currentLabel} · 已收 {snap.fee.collectedWan}/{snap.fee.designFeeWan} 万
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {snap.nodes.map((n) => (
                    <span
                      key={n.id}
                      className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-11 font-medium",
                        BIZ_NODE_CLASS[n.status]
                      )}
                    >
                      {n.label}
                      {n.status === "done" && <span className="ml-1 text-tertiary">✓</span>}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </FsCard>

        {/* 在手项目 — 卡片 */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-13 font-semibold text-primary">在手项目</h2>
            <span className="text-11 text-tertiary">点击进入 → 概览</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PM_PROJECTS.map((p) => {
              const snap = snapById[p.id];
              const fee = snap?.fee;
              const designPct = snap?.designPct ?? p.progress;
              const stageLabel = snap?.focusStageLabel ?? p.stageLabel;
              const bizLabel = snap?.currentLabel;
              return (
                <Link
                  key={p.id}
                  to={`/${ws}/projects/${p.id}/overview`}
                  className="group flex flex-col rounded-lg border border-subtle bg-surface-1 p-4 shadow-sm transition-colors hover:border-accent-primary/40 hover:bg-surface-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-20 leading-none">{p.emoji}</span>
                      <div className="min-w-0">
                        <div className="truncate text-13 font-semibold text-primary group-hover:text-accent-primary">
                          {p.name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-11 text-tertiary">
                          <span className="font-mono">{p.identifier}</span>
                          <span>·</span>
                          <MapPin className="size-3" />
                          {p.city}
                          <span>·</span>
                          {p.houseType}
                        </div>
                      </div>
                    </div>
                    <span className={cn("shrink-0 rounded-sm px-1.5 py-0.5 text-11 font-medium", RISK_CLASS[p.risk])}>
                      {p.risk}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <FsTag>设计 · {stageLabel}</FsTag>
                    {bizLabel && <FsTag>经营 · {bizLabel}</FsTag>}
                    <FsTag>客户 · {p.clientName}</FsTag>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-11 text-tertiary">
                      <span>设计阶段（已确认）</span>
                      <span>
                        {snap?.confirmedStages ?? 0}/{snap?.stageTotal ?? 7} · {designPct}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent-primary" style={{ width: `${designPct}%` }} />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-subtle pt-3 text-11 text-secondary">
                    <span>
                      任务 {p.openTasks}
                      {p.overdueTasks > 0 && (
                        <span className="ml-1 text-danger-primary">· {p.overdueTasks} 逾期</span>
                      )}
                    </span>
                    <span className="text-tertiary">
                      设计费 {fee?.collectedWan ?? p.feeCollectedWan}/{fee?.designFeeWan ?? p.designFeeWan} 万
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-11 text-tertiary">
                    <Users className="size-3" />
                    {p.members.join(" · ")}
                    <span className="ml-auto">{p.updatedAt}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-5">
          {/* 分配给我 */}
          <FsCard className="p-0 lg:col-span-3">
            <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
              <div>
                <FsCardTitle>分配给我的工作</FsCardTitle>
                <FsMuted>跨项目 · 与「我的工作」同源</FsMuted>
              </div>
              <Link
                to={`/${ws}/profile/user-local-1`}
                className="inline-flex items-center gap-0.5 text-11 font-medium text-accent-primary hover:underline"
              >
                全部 <ArrowRight className="size-3" />
              </Link>
            </div>
            <ul className="divide-y divide-subtle">
              {myOpen.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/${ws}/projects/${a.projectId}/issues`}
                    className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-2/60"
                  >
                    <span className="mt-0.5 w-12 shrink-0 font-mono text-11 text-placeholder">{a.key}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-13 font-medium text-primary">{a.title}</div>
                      <div className="mt-0.5 text-11 text-tertiary">
                        {a.projectName} · {a.stageLabel} · 截止 {a.dueDate}
                      </div>
                    </div>
                    <FsTag>{PRIORITY_LABEL[a.priority]}</FsTag>
                  </Link>
                </li>
              ))}
            </ul>
          </FsCard>

          {/* 设计费 + 快捷 */}
          <div className="flex flex-col gap-3 lg:col-span-2">
            <FsCard>
              <FsCardTitle>设计费概览</FsCardTitle>
              <FsMuted className="mb-3">与经营节点同源 · 待收 {feePending} 万</FsMuted>
              <ul className="space-y-2">
                {studioSnaps.map((snap) => {
                  const p = PM_PROJECTS.find((x) => x.id === snap.projectId);
                  return (
                    <li key={snap.projectId}>
                      <div className="mb-0.5 flex justify-between text-11">
                        <span className="truncate text-secondary">{p?.identifier ?? snap.projectName}</span>
                        <span className="text-tertiary">
                          {snap.fee.collectedWan}/{snap.fee.designFeeWan} 万
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-accent-primary/80"
                          style={{ width: `${snap.fee.pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </FsCard>
            <FsCard>
              <FsCardTitle>工作室快捷入口</FsCardTitle>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <QuickLink href={`/${ws}/customers`} label="客户" desc="CRM 线索" />
                <QuickLink href={`/${ws}/library?mode=purchase`} label="采购清单" desc="生态库加购" />
                <QuickLink href={`/${ws}/library`} label="生态库" desc="单品/组合/案例" />
                <QuickLink href={`/${ws}/canvas`} label="意向画布" desc="L1 创作" />
                <QuickLink href={`/${ws}/space`} label="3D模型" desc="墙体·图块布局" />
                <QuickLink href={`/${ws}/drafts`} label="草稿箱" desc="未发布工作项" />
                <QuickLink href={`/${ws}/users`} label="用户管理" desc="成员·席位" />
                <QuickLink
                  href={`/${ws}/projects/proj-demo-1/stages/style`}
                  label="继续设计"
                  desc="滨江 · 风格"
                />
              </div>
            </FsCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  href,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  tone?: "warn";
}) {
  const inner = (
    <div
      className={cn(
        "rounded-lg border border-subtle bg-surface-1 p-3 shadow-sm transition-colors",
        href && "hover:border-accent-primary/30"
      )}
    >
      <div className="flex items-center gap-1.5 text-11 text-tertiary">
        {icon}
        {label}
      </div>
      <div className={cn("mt-1 text-20 font-semibold text-primary", tone === "warn" && "text-danger-primary")}>
        {value}
      </div>
    </div>
  );
  if (href) return <Link to={href}>{inner}</Link>;
  return inner;
}

function QuickLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link
      to={href}
      className="rounded-md border border-subtle bg-surface-2/50 px-2.5 py-2 transition-colors hover:bg-surface-2"
    >
      <div className="text-13 font-medium text-primary">{label}</div>
      <div className="text-11 text-tertiary">{desc}</div>
    </Link>
  );
}
