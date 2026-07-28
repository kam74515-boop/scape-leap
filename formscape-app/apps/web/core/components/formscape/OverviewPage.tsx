/**
 * 项目概览 — 双轴同屏（规范 v3 换装）
 * A 经营节点 FsSteps · B 设计阶段七段三态胶囊 · 设计费同源经营节点
 */
import { Link } from "react-router";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { STAGES } from "./types";
import { useFormscapeProject } from "./use-formscape-project";
import { useProjectProgress } from "./use-project-progress";
import { stageStateLabel } from "./project-progress-store";
import { useTasksStore } from "./tasks-store";
import {
  FsButton,
  FsCard,
  FsCardTitle,
  FsMuted,
  FsPageBody,
  FsPageShell,
  FsPageTitle,
  FsPrimaryLink,
  FsProgress,
  FsStat,
  FsSteps,
  FsTag,
  FsTextLink,
} from "./ui";

type Props = {
  workspaceSlug: string;
  projectId: string;
};

export function FormscapeOverviewPage({ workspaceSlug, projectId }: Props) {
  const { project } = useFormscapeProject(projectId);
  const p = project.profile;
  const { state, bizNodes, fee, design, onAdvanceBiz, onSetBizDoneMax } = useProjectProgress(projectId);
  const searchParams = useSearchParams();
  const highlightBiz = searchParams.get("biz");
  const base = `/${workspaceSlug}/projects/${projectId}`;
  const { projectTasks: tasks } = useTasksStore(projectId);
  const taskByStage = useMemo(() => {
    const map: Record<string, number> = { biz: 0 };
    for (const s of STAGES) map[s.id] = 0;
    for (const t of tasks) {
      if (!t.stageId) map.biz += 1;
      else if (map[t.stageId] !== undefined) map[t.stageId] += 1;
    }
    return map;
  }, [tasks]);
  const openTasks = useMemo(() => tasks.filter((t) => t.state !== "done").length, [tasks]);

  const focusMeta = STAGES.find((s) => s.id === state.focusStage);
  const bizCurrentIndex = bizNodes.findIndex((n) => n.status === "current");
  const bizStepsCurrent = bizCurrentIndex === -1 ? bizNodes.length : bizCurrentIndex;

  return (
    <>
      <PageHead title={`${project.name} · 概览`} />
      <FsPageShell>
        <FsPageBody>
          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <FsPageTitle>概览</FsPageTitle>
                <FsMuted className="mt-0.5">
                  {project.name} · 经营 + 设计双轴 · 设计费与经营节点同源
                </FsMuted>
              </div>
              <FsPrimaryLink to={`${base}/stages/${state.focusStage}`}>
                进入设计 · {focusMeta?.label ?? "—"} →
              </FsPrimaryLink>
            </div>

            {/* KPI */}
            <FsCard>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <FsStat
                  label="设计费已收（万）"
                  value={fee.collectedWan}
                  trend={`${fee.pct}%`}
                  trendTone="brand"
                  hint={`总额 ${fee.designFeeWan} 万`}
                />
                <FsStat
                  label="设计费待收（万）"
                  value={fee.pendingWan}
                  hint="随经营节点自动结转"
                />
                <FsStat
                  label="阶段确认"
                  value={`${design.confirmed}/${design.total}`}
                  trend={design.staleCount > 0 ? `${design.staleCount} 过期` : undefined}
                  trendTone="danger"
                  hint={`当前焦点 · ${focusMeta?.label ?? "—"}`}
                />
                <FsStat label="未完任务" value={openTasks} hint={`共 ${tasks.length} 项`} />
              </div>
            </FsCard>

            {/* 项目信息 */}
            <FsCard>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <FsCardTitle className="mb-0">项目信息</FsCardTitle>
                <FsTextLink to={`${base}/stages/requirements`}>编辑客户与档案 →</FsTextLink>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-13 text-secondary">
                {p.clientName ? (
                  <>
                    <span className="font-medium text-primary">{p.clientName}</span>
                    {p.clientPhone && <span className="text-11 text-tertiary">{p.clientPhone}</span>}
                  </>
                ) : (
                  <FsMuted>未填写客户 · 在「需求分析」中维护</FsMuted>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[p.city, p.houseType, p.rooms, p.area ? `${p.area} ㎡` : null, p.style, p.budget ? `预算 ${p.budget} 万` : null]
                  .filter(Boolean)
                  .map((t) => (
                    <FsTag key={String(t)}>{t}</FsTag>
                  ))}
              </div>
            </FsCard>

            {/* A 经营节点 */}
            <FsCard id="project-progress">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <FsCardTitle className="mb-0">经营节点</FsCardTitle>
                  <FsMuted className="mt-0.5">签约 / 款项 / 确认 · 驱动设计费已收 · 点胶囊设进度</FsMuted>
                </div>
                <FsButton size="sm" onClick={onAdvanceBiz}>
                  推进下一节点
                </FsButton>
              </div>
              <FsSteps
                steps={bizNodes.map((n) => ({
                  key: n.id,
                  label: n.feeShare > 0 ? `${n.label} ${Math.round(n.feeShare * 100)}%` : n.label,
                }))}
                current={bizStepsCurrent}
                onStepClick={(i) => onSetBizDoneMax(i)}
              />
              {highlightBiz && (
                <FsMuted className="mt-1.5">来自仪表盘定位 · 节点 {highlightBiz}</FsMuted>
              )}
              {/* 设计费同源 */}
              <div className="mt-4 rounded-lg border border-subtle bg-surface-2/50 px-3 py-2.5">
                <div className="mb-1.5 flex justify-between text-11 text-tertiary">
                  <span>设计费（与经营节点同源）</span>
                  <span className="tabular-nums">
                    已收 {fee.collectedWan} / 总额 {fee.designFeeWan} 万 · 待收 {fee.pendingWan} 万
                  </span>
                </div>
                <FsProgress ai={false} value={fee.pct} />
              </div>
            </FsCard>

            {/* B 设计阶段 */}
            <FsCard>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <FsCardTitle className="mb-0">设计阶段</FsCardTitle>
                  <FsMuted className="mt-0.5">未开始 / 进行中 / 已确认 · 可回跳 · 下游过期会标记</FsMuted>
                </div>
                <FsPrimaryLink to={`${base}/stages/${state.focusStage}`}>
                  进入 · {focusMeta?.label} →
                </FsPrimaryLink>
              </div>
              <div className="mb-1.5 flex justify-between text-11 text-tertiary">
                <span>已确认 {design.confirmed}/{design.total}</span>
                <span className="tabular-nums">{design.pct}%</span>
              </div>
              <FsProgress ai={false} value={design.pct} className="mb-3" />
              <div className="flex flex-wrap gap-1.5">
                {STAGES.map((s, i) => {
                  const st = state.stageStates[s.id];
                  const stale = state.staleStages.includes(s.id);
                  const n = taskByStage[s.id] ?? 0;
                  return (
                    <Link
                      key={s.id}
                      to={`${base}/stages/${s.id}`}
                      title={`${s.label} · ${stageStateLabel(st)}`}
                      className={cn(
                        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-11 font-medium transition-colors",
                        st === "confirmed" && "bg-accent-primary text-on-color hover:brightness-105",
                        st === "in_progress" &&
                          "border border-accent-strong bg-accent-subtle text-accent-secondary",
                        st === "not_started" &&
                          "bg-surface-2 text-tertiary hover:bg-layer-transparent-hover"
                      )}
                    >
                      <span className="tabular-nums opacity-70">{i + 1}</span>
                      {s.label}
                      {n > 0 && <span className="opacity-70 tabular-nums">·{n}</span>}
                      {stale && (
                        <span className="rounded-full bg-danger-subtle px-1 text-10 text-danger-primary">
                          过期
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </FsCard>

            {/* 4 跳转卡（hover 上浮） */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link to={`${base}/issues`} className="block">
                <FsCard interactive className="h-full">
                  <FsCardTitle>任务</FsCardTitle>
                  <FsMuted>
                    执行轴 · 共 {tasks.length} 项 · 未完 {openTasks}
                    {(taskByStage.biz ?? 0) > 0 ? ` · 经营 ${taskByStage.biz}` : ""}
                  </FsMuted>
                  <div className="mt-2 text-12 font-medium text-accent-primary">打开任务 →</div>
                </FsCard>
              </Link>
              <Link to={`/${workspaceSlug}/canvas?project=${projectId}`} className="block">
                <FsCard interactive className="h-full">
                  <FsCardTitle>意向画布</FsCardTitle>
                  <FsMuted>L1 创作台 · 绑定本项目素材</FsMuted>
                  <div className="mt-2 text-12 font-medium text-accent-primary">打开画布 →</div>
                </FsCard>
              </Link>
              <Link to={`${base}/ppt`} className="block">
                <FsCard interactive className="h-full">
                  <FsCardTitle>汇报 PPT</FsCardTitle>
                  <FsMuted>对外表达 · 灌入已确认资产</FsMuted>
                  <div className="mt-2 text-12 font-medium text-accent-primary">打开汇报 →</div>
                </FsCard>
              </Link>
              <Link to={`${base}/files`} className="block">
                <FsCard interactive className="h-full">
                  <FsCardTitle>文件</FsCardTitle>
                  <FsMuted>图纸 · 效果图 · 合同</FsMuted>
                  <div className="mt-2 text-12 font-medium text-accent-primary">打开文件 →</div>
                </FsCard>
              </Link>
            </div>
          </div>
        </FsPageBody>
      </FsPageShell>
    </>
  );
}
