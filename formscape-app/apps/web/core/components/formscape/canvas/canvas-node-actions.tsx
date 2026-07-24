/**
 * 画布节点写回 — 受控 ReactFlow 下节点内必须用父级 setNodes，
 * 不能用 useReactFlow().setNodes（会写进 store 后被 props 盖回 → 一点就闪掉）
 */
import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { CanvasNodeData } from "./types";
import type { FsCanvasNode } from "./use-canvas-document";

type CanvasNodeActions = {
  patchNodeData: (id: string, partial: Partial<CanvasNodeData>) => void;
  updateNode: (id: string, updater: (node: FsCanvasNode) => FsCanvasNode) => void;
};

const Ctx = createContext<CanvasNodeActions | null>(null);

export function CanvasNodeActionsProvider({
  setNodes,
  children,
}: {
  setNodes: React.Dispatch<React.SetStateAction<FsCanvasNode[]>>;
  children: ReactNode;
}) {
  const patchNodeData = useCallback(
    (id: string, partial: Partial<CanvasNodeData>) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id
            ? ({
                ...n,
                data: { ...(n.data as CanvasNodeData), ...partial },
              } as FsCanvasNode)
            : n
        )
      );
    },
    [setNodes]
  );

  const updateNode = useCallback(
    (id: string, updater: (node: FsCanvasNode) => FsCanvasNode) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? updater(n) : n)));
    },
    [setNodes]
  );

  return <Ctx.Provider value={{ patchNodeData, updateNode }}>{children}</Ctx.Provider>;
}

export function useCanvasNodeActions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCanvasNodeActions must be used within CanvasNodeActionsProvider");
  return ctx;
}
