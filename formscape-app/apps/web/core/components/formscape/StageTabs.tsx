import { Link } from "react-router";
import { cn } from "@plane/utils";
import { STAGES, type StageId } from "./types";
import { useProjectProgress } from "./use-project-progress";
import { stageStateLabel } from "./project-progress-store";

type Props = {
  workspaceSlug: string;
  projectId: string;
  active: StageId;
};

/**
 * 阶段切换胶囊（三态 · 规范 v3）
 * done=brand 实底 · in_progress=brand 描边 · not_started=灰 · stale=danger 软色块提示
 */
export function StageTabs({ workspaceSlug, projectId, active }: Props) {
  const { state } = useProjectProgress(projectId);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STAGES.map((s, i) => {
        const href = `/${workspaceSlug}/projects/${projectId}/stages/${s.id}`;
        const isActive = s.id === active;
        const st = state.stageStates[s.id];
        const stale = state.staleStages.includes(s.id);
        return (
          <Link
            key={s.id}
            to={href}
            title={`${s.label} · ${stageStateLabel(st)}${stale ? " · 上游有更新" : ""}`}
            className={cn(
              "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-11 font-medium transition-colors",
              st === "confirmed" && "bg-accent-primary text-on-color hover:brightness-105",
              st === "in_progress" &&
                "border border-accent-strong bg-accent-subtle text-accent-secondary",
              st === "not_started" && "bg-surface-2 text-tertiary hover:bg-layer-transparent-hover",
              isActive && "ring-2 ring-accent-primary/35"
            )}
          >
            <span className="tabular-nums opacity-70">{i + 1}</span>
            {s.label}
            {stale && (
              <span className="rounded-full bg-danger-subtle px-1 text-10 font-medium text-danger-primary">
                过期
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
