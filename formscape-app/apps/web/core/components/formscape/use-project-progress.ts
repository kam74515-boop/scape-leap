import { useCallback, useEffect, useMemo, useState } from "react";
import type { StageId } from "./types";
import {
  advanceBizNode,
  confirmStage,
  enterStage,
  getBizNodesView,
  getDesignFeeProgress,
  getDesignStageProgress,
  getProjectProgress,
  PROGRESS_CHANGE_EVENT,
  reopenStage,
  setBizDoneMax,
  type ProjectProgressState,
} from "./project-progress-store";

export function useProjectProgress(projectId: string) {
  const [state, setState] = useState<ProjectProgressState>(() => getProjectProgress(projectId));
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setState(getProjectProgress(projectId));
    setTick((t) => t + 1);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [projectId, refresh]);

  /** 同页他组件 / 他标签写入后同步 */
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId?: string }>).detail;
      if (!detail?.projectId || detail.projectId === projectId) refresh();
    };
    window.addEventListener(PROGRESS_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(PROGRESS_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [projectId, refresh]);

  const onEnterStage = useCallback(
    (stage: StageId) => {
      setState(enterStage(projectId, stage));
    },
    [projectId]
  );

  const onConfirmStage = useCallback(
    (stage: StageId) => {
      setState(confirmStage(projectId, stage));
    },
    [projectId]
  );

  const onReopenStage = useCallback(
    (stage: StageId) => {
      setState(reopenStage(projectId, stage));
    },
    [projectId]
  );

  const onAdvanceBiz = useCallback(() => {
    setState(advanceBizNode(projectId));
  }, [projectId]);

  const onSetBizDoneMax = useCallback(
    (max: number) => {
      setState(setBizDoneMax(projectId, max));
    },
    [projectId]
  );

  // tick 强制在跨组件事件后重算
  const bizNodes = useMemo(() => {
    void tick;
    return getBizNodesView(projectId);
  }, [projectId, state.bizDoneMax, tick]);

  const fee = useMemo(() => {
    void tick;
    return getDesignFeeProgress(projectId);
  }, [projectId, state.bizDoneMax, state.designFeeWan, tick]);

  const design = useMemo(() => {
    void tick;
    return getDesignStageProgress(projectId);
  }, [projectId, state.stageStates, state.focusStage, state.staleStages, tick]);

  return {
    state,
    bizNodes,
    fee,
    design,
    refresh,
    onEnterStage,
    onConfirmStage,
    onReopenStage,
    onAdvanceBiz,
    onSetBizDoneMax,
  };
}

/** 工作室级：任意项目进度变更时刷新快照 */
export function useStudioProgressTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(PROGRESS_CHANGE_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(PROGRESS_CHANGE_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);
  return tick;
}
