import { memo, useState } from "react";
import { type Node, type NodeProps, NodeResizer } from "@xyflow/react";
import { cn } from "@plane/utils";
import { useCanvasNodeActions } from "../canvas-node-actions";
import type { FrameNodeData } from "../types";

type FrameNodeType = Node<FrameNodeData, "frame">;

function FrameNodeComponent({ id, data, selected }: NodeProps<FrameNodeType>) {
  const { patchNodeData } = useCanvasNodeActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);

  const commit = () => {
    setEditing(false);
    const label = draft.trim() || "画板";
    patchNodeData(id, { label } as Partial<FrameNodeData>);
    setDraft(label);
  };

  return (
    <div
      className={cn(
        "relative size-full min-h-[120px] min-w-[200px] rounded-lg border-2 border-dashed",
        selected ? "border-accent-primary" : "border-subtle"
      )}
      style={{ background: data.tint ?? "transparent" }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={100}
        lineClassName="!border-accent-primary"
        handleClassName="!h-2 !w-2 !rounded-sm !border-accent-primary !bg-surface-1"
      />
      <div className="absolute -top-6 left-0 flex items-center gap-1.5">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setEditing(false);
                setDraft(data.label);
              }
            }}
            className="nodrag h-5 rounded-sm border border-accent-primary bg-surface-1 px-1.5 text-[10px] font-semibold text-primary outline-none"
          />
        ) : (
          <button
            type="button"
            className="nodrag rounded-sm bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-secondary hover:bg-layer-transparent-hover"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setDraft(data.label || "画板");
              setEditing(true);
            }}
            title="双击重命名"
          >
            {data.label || "画板"}
          </button>
        )}
      </div>
    </div>
  );
}

export const FrameNode = memo(FrameNodeComponent);
