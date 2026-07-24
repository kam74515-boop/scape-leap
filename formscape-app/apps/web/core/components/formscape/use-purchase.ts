import { useCallback, useEffect, useMemo, useState } from "react";
import type { EcoProduct } from "./ecology-mock";
import {
  addComboToPurchase,
  addProductToPurchase,
  assignLineToProject,
  getPurchaseCount,
  getPurchaseLines,
  getPurchaseLinesForProject,
  getPurchaseLinesForProjectScope,
  getPurchaseTotals,
  getPurchaseTotalsForProject,
  PURCHASE_CHANGE_EVENT,
  removePurchaseLine,
  submitDraftAsQuoted,
  updatePurchaseLine,
  type PurchaseLine,
  type PurchaseStatus,
} from "./purchase-store";

export function usePurchase(projectId?: string) {
  const [lines, setLines] = useState<PurchaseLine[]>(() =>
    typeof window === "undefined" ? [] : getPurchaseLines()
  );
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setLines(getPurchaseLines());
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(PURCHASE_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(PURCHASE_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const projectLines = useMemo(() => {
    void tick;
    if (!projectId) return lines.filter((l) => l.status !== "cancelled");
    return getPurchaseLinesForProject(projectId);
  }, [projectId, lines, tick]);

  const projectScopeLines = useMemo(() => {
    void tick;
    if (!projectId) return projectLines;
    return getPurchaseLinesForProjectScope(projectId, { includeUnassigned: true });
  }, [projectId, projectLines, tick]);

  const count = useMemo(() => {
    void tick;
    if (projectId) {
      return projectLines.reduce((s, l) => s + l.qty, 0);
    }
    return getPurchaseCount();
  }, [tick, projectId, projectLines]);

  const totals = useMemo(() => {
    void tick;
    if (projectId) return getPurchaseTotalsForProject(projectId);
    return getPurchaseTotals(lines);
  }, [tick, lines, projectId]);

  const addProduct = useCallback(
    (product: EcoProduct, opts?: { qty?: number; projectId?: string | null }) => {
      const pid = opts?.projectId !== undefined ? opts.projectId : (projectId ?? null);
      setLines(addProductToPurchase(product, { ...opts, projectId: pid }));
    },
    [projectId]
  );

  const addCombo = useCallback(
    (productIds: string[], pid?: string | null) => {
      setLines(addComboToPurchase(productIds, { projectId: pid !== undefined ? pid : (projectId ?? null) }));
    },
    [projectId]
  );

  const setQty = useCallback((id: string, qty: number) => {
    setLines(updatePurchaseLine(id, { qty }));
  }, []);

  const setStatus = useCallback((id: string, status: PurchaseStatus) => {
    setLines(updatePurchaseLine(id, { status }));
  }, []);

  const setProject = useCallback((id: string, nextProjectId: string | null) => {
    setLines(updatePurchaseLine(id, { projectId: nextProjectId }));
  }, []);

  const claimToProject = useCallback(
    (lineId: string) => {
      if (!projectId) return;
      setLines(assignLineToProject(lineId, projectId));
    },
    [projectId]
  );

  const remove = useCallback((id: string) => {
    setLines(removePurchaseLine(id));
  }, []);

  const submitDrafts = useCallback(
    (pid?: string | null) => {
      setLines(submitDraftAsQuoted(pid !== undefined ? pid : (projectId ?? null)));
    },
    [projectId]
  );

  return {
    /** 全量清单 */
    lines,
    /** 仅本项目 */
    projectLines,
    /** 本项目 + 未归属（项目内认领） */
    projectScopeLines,
    count,
    totals,
    refresh,
    addProduct,
    addCombo,
    setQty,
    setStatus,
    setProject,
    claimToProject,
    remove,
    submitDrafts,
  };
}
