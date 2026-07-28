/**
 * 图片节点：无卡片容器，仅图本身；标题在右上角上方
 * 选中高亮：直角细框，无圆角容器感
 */
import { memo } from "react";
import { type Node, type NodeProps, NodeResizer } from "@xyflow/react";
import { ImageIcon, Lock } from "lucide-react";
import { cn } from "@plane/utils";
import type { ImageNodeData } from "../types";
import { RESIZER_LINE } from "./selection-chrome";

type ImageNodeType = Node<ImageNodeData, "image">;

/** 图片专用：直角缩放把手（非圆点） */
const IMAGE_RESIZER_HANDLE =
  "!h-1.5 !w-1.5 !rounded-none !border !border-accent-primary !bg-surface-1";

function ImageNodeComponent({ data, selected }: NodeProps<ImageNodeType>) {
  const label = data.title?.trim() || "";

  return (
    <div className="group relative size-full min-h-[80px] min-w-[80px]">
      <NodeResizer
        isVisible={selected && !data.locked}
        minWidth={80}
        minHeight={80}
        lineClassName={RESIZER_LINE}
        handleClassName={IMAGE_RESIZER_HANDLE}
      />

      {/* 标注：左上角上方，单行简约小字 */}
      {(label || data.locked) && (
        <div
          className={cn(
            "pointer-events-none absolute bottom-full left-0 z-[1] mb-0.5 flex max-w-full items-center gap-0.5",
            "opacity-55 transition-opacity group-hover:opacity-90",
            selected && "opacity-80"
          )}
        >
          {data.locked && <Lock className="size-2.5 shrink-0 text-tertiary" strokeWidth={1.75} />}
          {label ? (
            <span className="truncate text-10 font-normal leading-none tracking-tight text-tertiary">
              {label}
            </span>
          ) : null}
        </div>
      )}

      {/* 纯图 + 直角选中环（无圆角、无卡片阴影；与其他节点同一 brand 环语言） */}
      <div
        className={cn(
          "relative size-full overflow-hidden bg-transparent",
          selected &&
            "shadow-[0_0_0_1px_var(--bg-accent-primary),0_0_0_3px_color-mix(in_srgb,var(--bg-accent-primary)_35%,transparent)]",
          data.locked && "opacity-90"
        )}
        style={
          !data.src
            ? { background: `linear-gradient(145deg, ${data.colors.join(",")})` }
            : undefined
        }
      >
        {data.src ? (
          <img
            src={data.src}
            alt={label || "image"}
            className="pointer-events-none size-full select-none object-contain"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <ImageIcon className="size-8 text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}

export const ImageNode = memo(ImageNodeComponent);
