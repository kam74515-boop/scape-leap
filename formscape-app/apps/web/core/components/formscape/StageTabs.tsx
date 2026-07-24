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

/** 内容区内阶段切换 + 三态徽标（响应进度 store） */
export function StageTabs({ workspaceSlug, projectId, active }: Props) {
  const { state } = useProjectProgress(projectId);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {STAGES.map((s) => {
        const href = `/${workspaceSlug}/projects/${projectId}/stages/${s.id}`;
        const isActive = s.id === active;
        const st = state.stageStates[s.id];
        const stale = state.staleStages.includes(s.id);
        return (
          <Link
            key={s.id}
            to={href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-11 font-medium transition-colors",
              isActive
                ? "bg-accent-primary text-on-color"
                : st === "confirmed"
                  ? "bg-accent-subtle text-accent-primary hover:opacity-90"
                  : "bg-surface-2 text-secondary hover:bg-layer-transparent-hover"
            )}
          >
            {s.label}
            {!isActive && (
              <span className="text-[10px] opacity-70">{stageStateLabel(st)}</span>
            )}
            {stale && <span className="text-[10px] text-danger-primary">!</span>}
          </Link>
        );
      })}
    </div>
  );
}
