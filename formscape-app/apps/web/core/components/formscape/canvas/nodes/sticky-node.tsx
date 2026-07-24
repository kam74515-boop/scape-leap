import { memo, useState } from "react";
import { type Node, type NodeProps, NodeResizer } from "@xyflow/react";
import { cn } from "@plane/utils";
import { useCanvasNodeActions } from "../canvas-node-actions";
import type { StickyNodeData } from "../types";

type StickyNodeType = Node<StickyNodeData, "sticky">;

function StickyNodeComponent({ id, data, selected }: NodeProps<StickyNodeType>) {
  const { patchNodeData } = useCanvasNodeActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.text);

  const commit = () => {
    setEditing(false);
    patchNodeData(id, { text: draft } as Partial<StickyNodeData>);
  };

  return (
    <div
      className={cn(
        "relative flex h-full min-h-[100px] w-full min-w-[140px] flex-col rounded-md border p-2.5 shadow-sm",
        selected
          ? "border-accent-primary shadow-[0_0_0_2px_color-mix(in_srgb,var(--bg-accent-primary)_28%,transparent)]"
          : "border-subtle/60"
      )}
      style={{ background: data.color }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setDraft(data.text);
        setEditing(true);
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={90}
        lineClassName="!border-accent-primary"
        handleClassName="!h-2 !w-2 !rounded-sm !border-accent-primary !bg-surface-1"
      />
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-secondary/70">便签</div>
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setEditing(false);
              setDraft(data.text);
            }
          }}
          className="nodrag nopan nowheel flex-1 resize-none bg-transparent text-13 leading-snug text-primary outline-none"
        />
      ) : (
        <div className="flex-1 whitespace-pre-wrap text-13 leading-snug text-primary">{data.text}</div>
      )}
    </div>
  );
}

export const StickyNode = memo(StickyNodeComponent);
