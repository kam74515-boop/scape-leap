import { memo } from "react";
import { type Node, type NodeProps, NodeResizer } from "@xyflow/react";
import { cn } from "@plane/utils";
import type { ShapeNodeData } from "../types";
import { RESIZER_HANDLE, RESIZER_LINE, SELECTED_RING } from "./selection-chrome";

type ShapeNodeType = Node<ShapeNodeData, "shape">;

function ShapeNodeComponent({ data, selected }: NodeProps<ShapeNodeType>) {
  const stroke = data.stroke || "#6366F1";
  const fill = data.fill || "#E0E7FF";

  return (
    <div className="relative size-full min-h-[48px] min-w-[48px]">
      <NodeResizer
        isVisible={selected}
        minWidth={40}
        minHeight={40}
        lineClassName={RESIZER_LINE}
        handleClassName={RESIZER_HANDLE}
      />
      {data.shape === "ellipse" && (
        <div
          className={cn(
            "size-full rounded-full border-2",
            selected && "shadow-[0_0_0_2px_color-mix(in_srgb,var(--bg-accent-primary)_40%,transparent)]"
          )}
          style={{ background: fill, borderColor: selected ? "var(--bg-accent-primary)" : stroke }}
        />
      )}
      {(data.shape === "rect" || !data.shape) && (
        <div
          className={cn("size-full rounded-md border-2", selected && SELECTED_RING)}
          style={{ background: fill, borderColor: selected ? undefined : stroke }}
        />
      )}
      {data.shape === "line" && (
        <div className="flex size-full items-center">
          <div className="h-0.5 w-full" style={{ background: stroke }} />
        </div>
      )}
      {data.shape === "arrow" && (
        <div className="flex size-full items-center px-1">
          <div className="relative h-0.5 w-full" style={{ background: stroke }}>
            <div
              className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[6px] border-l-[10px] border-y-transparent"
              style={{ borderLeftColor: stroke }}
            />
          </div>
        </div>
      )}
      {data.label && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-11 font-medium text-primary">
          {data.label}
        </div>
      )}
    </div>
  );
}

export const ShapeNode = memo(ShapeNodeComponent);
