/**
 * 项目概览 — 双轴同屏
 * A 经营节点（无 L2 三级）· B 设计阶段条 · 设计费同源经营节点
 */
import { Link } from "react-router";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { STAGES } from "./types";
import { tasksForProject } from "./pm-mock";
import { useFormscapeProject } from "./use-formscape-project";
import { useProjectProgress } from "./use-project-progress";
import { stageStateLabel, type BizNodeStatus, type StageState } from "./project-progress-store";
import {
  FsCard,
  FsCardTitle,
  FsMuted,
  FsPageBody,
  FsPageShell,
  FsPrimaryLink,
  FsSecondaryLink,
  FsTag,
  FsTextLink,
} from "./ui";

type Props = {
  workspaceSlug: string;
  projectId: string;
};

const BIZ_CLASS: Record<BizNodeStatus, string> = {
  done: "border-transparent bg-surface-2 text-secondary",
  current: "border-accent-primary/40 bg-accent-subtle text-accent-primary",
  todo: "border-subtle bg-surface-1 text-placeholder",
  blocked: "border-danger-subtle bg-danger-subtle text-danger-primary",
};

const STAGE_CLASS: Record<StageState, string> = {
  confirmed: "border-transparent bg-accent-subtle text-accent-primary",
  in_progress: "border-transparent bg-accent-primary text-on-color",
  not_started: "border-subtle bg-surface-1 text-placeholder",
};

export function FormscapeOverviewPage({ workspaceSlug, projectId }: Props) {
  const { project } = useFormscapeProject();
  const p = project.profile;
  const { state, bizNodes, fee, design, onAdvanceBiz, onSetBizDoneMax, onEnterStage } =
    useProjectProgress(projectId);
  const searchParams = useSearchParams();
  const highlightBiz = searchParams.get("biz");
  const base = `/${workspaceSlug}/projects/${projectId}`;
  const tasks = useMemo(() => tasksForProject(projectId), [projectId]);
  const taskByStage = useMemo(() => {
    const map: Record<string, number> = { biz: 0 };
    for (const s of STAGES) map[s.id] = 0;
    for (const t of tasks) {
      if (!t.stageId) map.biz += 1;
      else if (map[t.stageId] !== undefined) map[t.stageId] += 1;
    }
    return map;
  }, [tasks]);

  useEffect(() => {
    // 进入概览时同步焦点阶段进入进行中
    onEnterStage(state.focusStage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const focusMeta = STAGES.find((s) => s.id === state.focusStage);

  return (
    <>
      <PageHead title={`${project.name} · 概览`} />
      <FsPageShell>
        <FsPageBody>
          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-13 font-semibold text-primary">概览</div>
                <FsMuted className="mt-0.5">
                  {project.name} · 经营 + 设计双轴 · 设计费与经营节点同源
                </FsMuted>
              </div>
              <FsPrimaryLink to={`${base}/stages/${state.focusStage}`}>
                进入设计 · {focusMeta?.label ?? "—"} →
              </FsPrimaryLink>
            </div>

            {/* 项目信息 */}
            <FsCard>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <FsCardTitle>项目信息</FsCardTitle>
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
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <FsCardTitle>经营节点</FsCardTitle>
                  <FsMuted>签约 / 款项 / 确认 · 无侧栏三级 · 驱动设计费已收</FsMuted>
                </div>
                <button
                  type="button"
                  onClick={onAdvanceBiz}
                  className="rounded-md bg-accent-primary px-2.5 py-1 text-11 font-medium text-on-color"
                >
                  推进下一节点
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {bizNodes.map((n, i) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onSetBizDoneMax(i)}
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-1 text-11 font-medium transition-colors",
                      BIZ_CLASS[n.status],
                      highlightBiz === n.id && "ring-1 ring-accent-primary"
                    )}
                    title="点击设为当前进度（含此前已完成）"
                  >
                    {n.label}
                    {n.status === "done" && <span className="ml-1 opacity-70">✓</span>}
                    {n.status === "current" && <span className="ml-1">当前</span>}
                    {n.feeShare > 0 && (
                      <span className="ml-1 opacity-60">{Math.round(n.feeShare * 100)}%</span>
                    )}
                  </button>
                ))}
              </div>
              {/* 设计费同源 */}
              <div className="mt-4 rounded-md border border-subtle bg-surface-2/50 px-3 py-2.5">
                <div className="mb-1 flex justify-between text-11 text-tertiary">
                  <span>设计费（与经营节点同源）</span>
                  <span>
                    已收 {fee.collectedWan} / 总额 {fee.designFeeWan} 万 · 待收 {fee.pendingWan} 万
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-1">
                  <div
                    className="h-full rounded-full bg-accent-primary"
                    style={{ width: `${fee.pct}%` }}
                  />
                </div>
              </div>
            </FsCard>

            {/* B 设计阶段 */}
            <FsCard>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <FsCardTitle>设计阶段</FsCardTitle>
                  <FsMuted>未开始 / 进行中 / 已确认 · 可回跳 · 下游过期会标记</FsMuted>
                </div>
                <FsPrimaryLink to={`${base}/stages/${state.focusStage}`}>
                  进入 · {focusMeta?.label} →
                </FsPrimaryLink>
              </div>
              <div className="mb-2 flex justify-between text-11 text-tertiary">
                <span>已确认 {design.confirmed}/{design.total}</span>
                <span>{design.pct}%</span>
              </div>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent-primary" style={{ width: `${design.pct}%` }} />
              </div>
              <div className="flex flex-wrap gap-1">
                {STAGES.map((s) => {
                  const st = state.stageStates[s.id];
                  const stale = state.staleStages.includes(s.id);
                  const n = taskByStage[s.id] ?? 0;
                  return (
                    <Link
                      key={s.id}
                      to={`${base}/stages/${s.id}`}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-11 font-medium",
                        STAGE_CLASS[st]
                      )}
                    >
                      {s.label}
                      <span className="opacity-70">{stageStateLabel(st)}</span>
                      {n > 0 && <span className="opacity-60">·{n}任务</span>}
                      {stale && (
                        <span className="rounded-sm bg-danger-subtle px-1 text-[10px] text-danger-primary">
                          上游有更新
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </FsCard>

            <div className="grid gap-3 md:grid-cols-2">
              <FsCard>
                <FsCardTitle>任务</FsCardTitle>
                <FsMuted className="mb-2">
                  执行轴 · stageId 绑定设计阶段 · 共 {tasks.length} 项
                  {(taskByStage.biz ?? 0) > 0 ? ` · 经营 ${taskByStage.biz}` : ""}
                </FsMuted>
                <div className="mb-3 flex flex-wrap gap-1">
                  {STAGES.filter((s) => (taskByStage[s.id] ?? 0) > 0).map((s) => (
                    <FsTag key={s.id}>
                      {s.label} {taskByStage[s.id]}
                    </FsTag>
                  ))}
                </div>
                <FsTextLink to={`${base}/issues`}>打开任务日历 →</FsTextLink>
              </FsCard>
              <FsCard>
                <FsCardTitle>意向画布</FsCardTitle>
                <FsMuted className="mb-3">L1 创作台 · 绑定本项目素材</FsMuted>
                <FsSecondaryLink to={`/${workspaceSlug}/canvas?project=${projectId}`}>
                  打开画布 →
                </FsSecondaryLink>
              </FsCard>
              <FsCard>
                <FsCardTitle>汇报 PPT</FsCardTitle>
                <FsMuted className="mb-3">对外表达 · 灌入已确认资产</FsMuted>
                <FsTextLink to={`${base}/ppt`}>打开汇报 →</FsTextLink>
              </FsCard>
              <FsCard>
                <FsCardTitle>文件</FsCardTitle>
                <FsMuted className="mb-3">图纸 · 效果图 · 合同</FsMuted>
                <FsTextLink to={`${base}/files`}>打开文件 →</FsTextLink>
              </FsCard>
            </div>
          </div>
        </FsPageBody>
      </FsPageShell>
    </>
  );
}
