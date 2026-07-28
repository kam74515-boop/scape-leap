/**
 * 首页 = 项目管理仪表盘（设计工作室在手项目）
 * 与 Plane Home widgets 完全不同：KPI + 项目卡片 + 分配 + 设计费
 */
import { Link } from "react-router";
import { useParams } from "next/navigation";
import { ArrowRight, MapPin, Users } from "@/icons";
import { cn } from "@plane/utils";
import { useMemo } from "react";
import { PRIORITY_LABEL } from "./pm-mock";
import { getStudioBizSnapshots } from "./project-progress-store";
import { getStudioKpi, getStudioProjectCards } from "./studio-model";
import { useStudioProgressTick } from "./use-project-progress";
import { useProjects } from "./projects-store";
import { formatDateKey, TASK_PRIORITY_LABEL, useTasksStore } from "./tasks-store";
import {
  FsCard,
  FsCardTitle,
  FsMuted,
  FsPageTitle,
  FsSecondaryLink,
  FsStat,
  FsSteps,
  FsTag,
  type FsTagTone,
} from "./ui";

/** 风险 chip → FsTag 软色块（规范 v3：正常/关注/延期 = success/warning/danger） */
const RISK_TONE: Record<string, FsTagTone> = {
  正常: "success",
  关注: "warning",
  延期: "danger",
};

export function FormscapeProjectsDashboard() {
  const { workspaceSlug } = useParams();
  const ws = workspaceSlug?.toString() ?? "formscape";
  const { projects } = useProjects();
  const { tasks } = useTasksStore();
  const progressTick = useStudioProgressTick();
  const studioSnaps = useMemo(() => {
    void progressTick;
    return getStudioBizSnapshots();
  }, [progressTick, projects]);
  // 统一 Project 数据模型（studio-model）：KPI 与项目卡全部同源派生
  const kpi = useMemo(() => {
    void tasks;
    void progressTick;
    return getStudioKpi();
  }, [tasks, progressTick, projects]);
  const cards = useMemo(() => {
    void tasks;
    void progressTick;
    return getStudioProjectCards();
  }, [tasks, progressTick, projects]);
  const feePending = kpi.feePendingWan;

  const myOpen = useMemo(() => {
    const nameById = new Map(projects.map((p) => [p.id, p.name]));
    return tasks
      .filter((t) => t.state !== "done")
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        key: t.key,
        title: t.title,
        projectId: t.projectId,
        projectName: nameById.get(t.projectId) ?? t.projectId,
        stageLabel: t.stageLabel,
        dueDate: t.dueDate ? formatDateKey(t.dueDate) : "—",
        priority: t.priority,
      }));
  }, [tasks, projects]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-surface-2">
      <div className="mx-auto w-full max-w-[1200px] space-y-4 px-3 py-4 md:px-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-11 font-medium text-accent-primary">构境 · 项目管理</div>
            <FsPageTitle className="mt-0.5">工作室仪表盘</FsPageTitle>
            <FsMuted className="mt-0.5">
              在手项目 · 经营节点 · 任务负荷 · 设计费 — 任务/草稿与各页同源
            </FsMuted>
          </div>
          <div className="flex flex-wrap gap-2">
            <FsSecondaryLink to={`/${ws}/profile/user-local-1`}>
              我的工作 <ArrowRight className="size-3" />
            </FsSecondaryLink>
            <FsSecondaryLink to={`/${ws}/drafts`}>
              草稿箱 <ArrowRight className="size-3" />
            </FsSecondaryLink>
          </div>
        </div>

        {/* KPI — 接 tasks-store / drafts / 经营节点 */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="在手项目" value={String(kpi.activeProjects)} trend="推进中" trendTone="brand" />
          <KpiCard
            label="我的待办"
            value={String(kpi.myOpenTasks)}
            hint="跨项目汇总"
            href={`/${ws}/profile/user-local-1`}
          />
          <KpiCard
            label="今日/紧急"
            value={
              <span className={cn(kpi.urgent > 0 && "text-danger-primary")}>{kpi.urgent}</span>
            }
            trend={kpi.urgent > 0 ? "需处理" : "已清空"}
            trendTone={kpi.urgent > 0 ? "danger" : "success"}
            href={`/${ws}/profile/user-local-1`}
          />
          <KpiCard
            label="工作项草稿"
            value={String(kpi.drafts)}
            hint="待发布"
            href={`/${ws}/drafts`}
          />
          <KpiCard label="设计费待收(万)" value={String(feePending)} trend="回款中" trendTone="success" />
        </div>

        {/* 经营节点：工作室仪表盘 · 不做 L2 第三级 */}
        <FsCard className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle px-4 py-3">
            <div>
              <FsCardTitle>经营节点</FsCardTitle>
              <FsMuted>工作室汇总 · 与设计费同源 · 单项目见概览</FsMuted>
            </div>
            <span className="text-11 text-tertiary tabular-nums">待收设计费合计 {feePending} 万</span>
          </div>
          <ul className="divide-y divide-subtle">
            {studioSnaps.map((snap) => {
              const currentIdx = snap.nodes.findIndex((n) => n.status === "current");
              const doneCount = snap.nodes.filter((n) => n.status === "done").length;
              return (
                <li key={snap.projectId} className="px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/${ws}/projects/${snap.projectId}/overview`}
                      className="text-13 font-medium text-primary hover:text-accent-primary"
                    >
                      {snap.projectName}
                    </Link>
                    <span className="text-11 text-tertiary tabular-nums">
                      当前 · {snap.currentLabel} · 已收 {snap.fee.collectedWan}/{snap.fee.designFeeWan} 万
                    </span>
                  </div>
                  <FsSteps
                    steps={snap.nodes.map((n) => ({ key: n.id, label: n.label }))}
                    current={currentIdx === -1 ? doneCount : currentIdx}
                  />
                </li>
              );
            })}
          </ul>
        </FsCard>

        {/* 在手项目 — 卡片 */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-13 font-semibold text-primary">在手项目</h2>
            <span className="text-11 text-tertiary">点击进入 → 概览</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <Link
                key={c.projectId}
                to={`/${ws}/projects/${c.projectId}/overview`}
                className="group flex flex-col rounded-lg border border-subtle bg-surface-1 p-4 transition-[transform,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-strong"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-12 font-semibold text-accent-secondary">
                      {c.identifier.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-13 font-semibold text-primary group-hover:text-accent-primary">
                        {c.name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-11 text-tertiary">
                        <span className="font-mono">{c.identifier}</span>
                        <span>·</span>
                        <MapPin className="size-3" />
                        {c.city}
                        <span>·</span>
                        {c.houseType}
                      </div>
                    </div>
                  </div>
                  <FsTag tone={RISK_TONE[c.risk] ?? "neutral"} className="shrink-0">
                    {c.risk}
                  </FsTag>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <FsTag>设计 · {c.focusStageLabel}</FsTag>
                  {c.bizLabel && <FsTag>经营 · {c.bizLabel}</FsTag>}
                  <FsTag>客户 · {c.clientName}</FsTag>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-11 text-tertiary">
                    <span>设计阶段（已确认）</span>
                    <span className="tabular-nums">
                      {c.confirmedStages}/{c.stageTotal} · {c.designPct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent-primary" style={{ width: `${c.designPct}%` }} />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-subtle pt-3 text-11 text-secondary">
                  <span className="tabular-nums">
                    任务 {c.openTasks}
                    {c.overdueTasks > 0 && (
                      <span className="ml-1 text-danger-primary">· {c.overdueTasks} 逾期</span>
                    )}
                  </span>
                  <span className="text-tertiary tabular-nums">
                    设计费 {c.feeCollectedWan}/{c.feeTotalWan} 万
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-11 text-tertiary">
                  <Users className="size-3" />
                  {c.members.join(" · ")}
                </div>
              </Link>
            ))}
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
              {myOpen.length === 0 ? (
                <li className="px-4 py-6 text-center text-11 text-tertiary">
                  暂无未完成任务 · 在项目任务页新建，或从草稿箱发布
                </li>
              ) : (
                myOpen.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/${ws}/projects/${a.projectId}/issues`}
                      className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-2/60"
                    >
                      <span className="mt-0.5 w-12 shrink-0 font-mono text-11 text-placeholder">
                        {a.key}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-13 font-medium text-primary">{a.title}</div>
                        <div className="mt-0.5 text-11 text-tertiary">
                          {a.projectName} · {a.stageLabel} · 截止 {a.dueDate}
                        </div>
                      </div>
                      <FsTag>
                        {TASK_PRIORITY_LABEL[a.priority] ?? PRIORITY_LABEL[a.priority] ?? a.priority}
                      </FsTag>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </FsCard>

          {/* 设计费 + 快捷 */}
          <div className="flex flex-col gap-3 lg:col-span-2">
            <FsCard>
              <FsCardTitle>设计费概览</FsCardTitle>
              <FsMuted className="mb-3 tabular-nums">与经营节点同源 · 待收 {feePending} 万</FsMuted>
              <ul className="space-y-2">
                {studioSnaps.map((snap) => {
                  const p = projects.find((x) => x.id === snap.projectId);
                  return (
                    <li key={snap.projectId}>
                      <div className="mb-0.5 flex justify-between text-11">
                        <span className="truncate text-secondary">{p?.identifier ?? snap.projectName}</span>
                        <span className="text-tertiary tabular-nums">
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
                <QuickLink href={`/${ws}/users`} label="团队管理" desc="成员·席位" />
                {studioSnaps[0] && (
                  <QuickLink
                    href={`/${ws}/projects/${studioSnaps[0].projectId}/stages/${studioSnaps[0].focusStage}`}
                    label="继续设计"
                    desc={`${studioSnaps[0].projectName} · ${studioSnaps[0].focusStageLabel}`}
                  />
                )}
              </div>
            </FsCard>
          </div>
        </div>
      </div>
    </div>
  );
}

/** KPI 卡：FsStat + 可点击时 hover 上浮 */
function KpiCard({
  label,
  value,
  trend,
  trendTone,
  hint,
  href,
}: {
  label: string;
  value: React.ReactNode;
  trend?: React.ReactNode;
  trendTone?: FsTagTone;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <div
      className={cn(
        "h-full rounded-lg border border-subtle bg-surface-1 p-3",
        href &&
          "transition-[transform,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-strong"
      )}
    >
      <FsStat label={label} value={value} trend={trend} trendTone={trendTone} hint={hint} />
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
