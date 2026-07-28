import { memo, useState } from "react";
import { type Node, type NodeProps, NodeResizer } from "@xyflow/react";
import { cn } from "@plane/utils";
import { useCanvasNodeActions } from "../canvas-node-actions";
import type { FrameNodeData } from "../types";
import { RESIZER_HANDLE, RESIZER_LINE, SELECTED_RING_SOFT } from "./selection-chrome";

type FrameNodeType = Node<FrameNodeData, "frame">;

/** 画板 tint 统一为 brand 浅底（规范 v3 §1：AI 紫只用于 AI 能力）。
 *  历史文档里的旧紫色 tint（rgba(139,92,246,*)）渲染时归一为 brand，下次保存即写回。 */
const LEGACY_VIOLET = /^rgba\(139,\s?92,\s?246,/;
function normalizeFrameTint(tint?: string): string {
  if (!tint) return "rgba(99,102,241,0.04)";
  if (LEGACY_VIOLET.test(tint)) return tint.replace(LEGACY_VIOLET, "rgba(99,102,241,");
  return tint;
}

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
        "relative size-full min-h-[120px] min-w-[200px] rounded-lg border border-dashed",
        selected ? cn("border-accent-primary", SELECTED_RING_SOFT) : "border-subtle"
      )}
      style={{ background: normalizeFrameTint(data.tint) }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={100}
        lineClassName={RESIZER_LINE}
        handleClassName={RESIZER_HANDLE}
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
            className="nodrag h-5 rounded-sm border border-accent-primary bg-surface-1 px-1.5 text-10 font-semibold text-primary outline-none"
          />
        ) : (
          <button
            type="button"
            className="nodrag rounded-sm bg-surface-2 px-1.5 py-0.5 text-10 font-semibold text-secondary hover:bg-layer-transparent-hover"
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
