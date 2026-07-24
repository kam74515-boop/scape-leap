import { memo } from "react";
import { type Node, type NodeProps, NodeResizer } from "@xyflow/react";
import { ImageIcon, Lock } from "lucide-react";
import { cn } from "@plane/utils";
import type { ImageNodeData } from "../types";

type ImageNodeType = Node<ImageNodeData, "image">;

function ImageNodeComponent({ data, selected }: NodeProps<ImageNodeType>) {
  return (
    <div
      className={cn(
        "group relative flex h-full min-h-[120px] w-full min-w-[160px] flex-col overflow-hidden rounded-lg border bg-surface-1 shadow-sm",
        selected
          ? "border-accent-primary shadow-[0_0_0_2px_color-mix(in_srgb,var(--bg-accent-primary)_28%,transparent)]"
          : "border-subtle",
        data.locked && "opacity-90"
      )}
    >
      <NodeResizer
        isVisible={selected && !data.locked}
        minWidth={140}
        minHeight={100}
        lineClassName="!border-accent-primary"
        handleClassName="!h-2 !w-2 !rounded-sm !border-accent-primary !bg-surface-1"
      />
      <div
        className="relative flex-1"
        style={data.src ? undefined : { background: `linear-gradient(145deg, ${data.colors.join(",")})` }}
      >
        {data.src ? (
          <img src={data.src} alt={data.title} className="size-full object-cover" draggable={false} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <ImageIcon className="size-8 text-primary" />
          </div>
        )}
        {data.locked && (
          <div className="absolute right-1.5 top-1.5 rounded-sm bg-surface-1/90 p-0.5 text-tertiary">
            <Lock className="size-3" />
          </div>
        )}
        {data.source && (
          <div className="absolute left-1.5 top-1.5 rounded-sm bg-surface-1/90 px-1 py-0.5 text-[9px] font-medium text-tertiary opacity-0 transition-opacity group-hover:opacity-100">
            {data.source}
          </div>
        )}
      </div>
      <div className="border-t border-subtle px-2.5 py-1.5">
        <div className="truncate text-11 font-medium text-primary">{data.title}</div>
        {data.tags?.length > 0 && (
          <div className="mt-0.5 truncate text-[10px] text-tertiary">{data.tags.join(" · ")}</div>
        )}
      </div>
    </div>
  );
}

export const ImageNode = memo(ImageNodeComponent);
