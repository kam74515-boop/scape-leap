/**
 * 视频生成节点 — 与图片生成器对齐的简约 PromptDock + 圆角选中环
 */
import { memo, useEffect, useState } from "react";
import { type Node, type NodeProps, NodeResizer } from "@xyflow/react";
import { Film, Loader2, Plus, Sparkles, Square, Video, X } from "@/icons";
import { cn } from "@plane/utils";
import { FsProgress } from "../../ui";
import { useCanvasNodeActions } from "../canvas-node-actions";
import type { VideoGenNodeData } from "../types";
import {
  ASPECT_RATIOS,
  VIDEO_MODELS,
  VIDEO_MODES,
  modelById,
  sizeForAspect,
  type VideoModeId,
} from "../models/catalog";
import { newId } from "../use-canvas-document";
import { RESIZER_HANDLE, RESIZER_LINE, SELECTED_RING } from "./selection-chrome";

type VideoGenNodeType = Node<VideoGenNodeData, "videogen">;

const DEMO_REF_COLORS = [
  ["#DBEAFE", "#60A5FA", "#1E40AF"],
  ["#FCE7F3", "#F9A8D4", "#BE185D"],
  ["#D1FAE5", "#34D399", "#047857"],
];

const CAMERA_MOVES = [
  { id: "static", label: "固定" },
  { id: "push-in", label: "推进" },
  { id: "orbit", label: "环绕" },
  { id: "pan", label: "横移" },
  { id: "crane", label: "升降" },
];

function VideoGenNodeComponent({ id, data: raw, selected }: NodeProps<VideoGenNodeType>) {
  const data: VideoGenNodeData = {
    ...raw,
    aspect: raw.aspect || "16:9",
    duration: raw.duration || 6,
    videoMode: raw.videoMode || "text",
    withAudio: !!raw.withAudio,
    cameraMove: raw.cameraMove || "push-in",
    refs: raw.refs ?? [],
  };
  const { patchNodeData } = useCanvasNodeActions();
  const [draft, setDraft] = useState(data.prompt);
  const isRunning = data.status === "running" || data.status === "queued";
  const isDone = data.status === "done";
  const isError = data.status === "error";
  const model = modelById(data.model);
  const durations = model?.durations ?? [4, 6, 8];
  const size = sizeForAspect(data.aspect || "16:9", 260);

  useEffect(() => {
    setDraft(data.prompt);
  }, [data.prompt]);

  const patch = (partial: Partial<VideoGenNodeData>) => {
    patchNodeData(id, partial);
  };

  const addRef = () => {
    if ((data.refs?.length ?? 0) >= (model?.maxRefs ?? 3)) return;
    const colors = DEMO_REF_COLORS[(data.refs?.length ?? 0) % DEMO_REF_COLORS.length];
    const nextRole =
      data.videoMode === "frames"
        ? data.refs?.some((r) => r.role === "start")
          ? "end"
          : "start"
        : "ref";
    patch({
      refs: [
        ...(data.refs ?? []),
        {
          id: newId("vref"),
          title: nextRole === "start" ? "首帧" : nextRole === "end" ? "尾帧" : `参考 ${(data.refs?.length ?? 0) + 1}`,
          colors,
          role: nextRole,
        },
      ],
    });
  };

  const removeRef = (refId: string) => {
    patch({ refs: (data.refs ?? []).filter((r) => r.id !== refId) });
  };

  const runGenerate = () => {
    if (isRunning || !draft.trim()) return;
    patch({ prompt: draft.trim() });
    window.dispatchEvent(new CustomEvent("fs-canvas-generate", { detail: { id, media: "video" } }));
  };

  const cancelGenerate = () => {
    window.dispatchEvent(new CustomEvent("fs-canvas-cancel", { detail: { id, media: "video" } }));
  };

  return (
    <div className="relative" style={{ width: size.width }}>
      <div className="pointer-events-none absolute -top-5 left-1 right-1 flex items-center gap-1 text-10 font-medium text-tertiary">
        <Video className="size-2.5 shrink-0" strokeWidth={2} />
        <span className="truncate">视频生成器</span>
        <span className="ml-auto text-10 text-placeholder">
          {data.duration}s · {model?.credits ?? 20} CU
        </span>
      </div>

      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={120}
        keepAspectRatio
        lineClassName={RESIZER_LINE}
        handleClassName={RESIZER_HANDLE}
      />

      <div
        className={cn(
          "relative flex w-full items-center justify-center overflow-hidden rounded-xl border bg-surface-1 transition-[box-shadow,border-color]",
          selected ? SELECTED_RING : "border-subtle",
          // 生成中：AI 紫描边（选中环保持 brand）
          isRunning &&
            !selected &&
            "border-ai-strong shadow-[0_0_0_2px_color-mix(in_srgb,var(--ai-default)_25%,transparent)]"
        )}
        style={{ height: size.height }}
      >
        {isDone && data.resultColors ? (
          <div
            className="flex size-full flex-col items-center justify-center gap-1"
            style={{ background: `linear-gradient(145deg, ${data.resultColors.join(",")})` }}
          >
            <Film className="size-8 text-white/80" />
            <span className="px-2 text-center text-10 font-medium text-white">
              {data.resultTitle || `${data.duration}s`}
            </span>
          </div>
        ) : isRunning ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <Loader2 className="size-7 animate-spin text-ai-primary" />
            <span className="text-11 tabular-nums text-tertiary">
              {data.status === "queued" ? "排队中…" : `生成中 ${data.progress ?? 0}%`}
            </span>
            <div className="w-28">
              <FsProgress value={data.progress ?? 8} />
            </div>
            <button
              type="button"
              className="nodrag inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-10 text-tertiary hover:bg-layer-transparent-hover"
              onClick={(e) => {
                e.stopPropagation();
                cancelGenerate();
              }}
            >
              <Square className="size-2.5 fill-current" />
              取消
            </button>
          </div>
        ) : isError ? (
          <div className="px-3 text-center text-11 text-danger-primary">{data.error || "生成失败"}</div>
        ) : (
          <Film className="size-12 text-placeholder opacity-40" strokeWidth={1.2} />
        )}
      </div>

      {selected && (
        <div
          className="nodrag nopan nowheel absolute left-1/2 top-[calc(100%+10px)] z-20 w-[min(360px,92vw)] -translate-x-1/2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="overflow-hidden rounded-xl border border-subtle bg-surface-1 shadow-md">
            <div className="flex gap-0.5 overflow-x-auto px-2 pt-2">
              {VIDEO_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() =>
                    patch({
                      videoMode: m.id as VideoModeId,
                      refs: m.id === "text" ? [] : data.refs,
                    })
                  }
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-10 font-medium",
                    (data.videoMode || "text") === m.id
                      ? "bg-accent-subtle text-accent-primary"
                      : "text-tertiary hover:text-secondary"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {data.videoMode !== "text" && (
              <div className="flex items-center gap-1 px-2 pt-1.5">
                {(data.refs ?? []).map((r) => (
                  <div
                    key={r.id}
                    className="group relative size-6 overflow-hidden rounded-md"
                    style={{ background: `linear-gradient(135deg, ${r.colors.join(",")})` }}
                    title={r.title}
                  >
                    <button
                      type="button"
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100"
                      onClick={() => removeRef(r.id)}
                    >
                      <X className="size-2.5 text-white" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addRef()}
                  className="flex size-6 items-center justify-center rounded-md text-placeholder hover:bg-layer-transparent-hover"
                >
                  <Plus className="size-3" />
                </button>
              </div>
            )}

            <textarea
              value={draft}
              rows={2}
              disabled={isRunning}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => patch({ prompt: draft })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  runGenerate();
                }
              }}
              placeholder="描述镜头与空间运动…"
              className="w-full resize-none border-0 bg-transparent px-2.5 py-1.5 text-11 leading-snug text-primary outline-none placeholder:text-placeholder"
            />

            <div className="flex flex-wrap items-center gap-0.5 border-t border-subtle/80 px-1.5 py-1">
              <select
                value={data.model}
                disabled={isRunning}
                onChange={(e) => patch({ model: e.target.value })}
                className="h-6 max-w-[6.5rem] border-0 bg-transparent px-1 text-10 text-secondary outline-none"
              >
                {VIDEO_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <span className="text-10 text-placeholder">·</span>
              <select
                value={data.aspect || "16:9"}
                disabled={isRunning}
                onChange={(e) => patch({ aspect: e.target.value })}
                className="h-6 border-0 bg-transparent px-0.5 text-10 text-secondary outline-none"
              >
                {ASPECT_RATIOS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <span className="text-10 text-placeholder">·</span>
              <select
                value={String(data.duration || 6)}
                disabled={isRunning}
                onChange={(e) => patch({ duration: Number(e.target.value) })}
                className="h-6 border-0 bg-transparent px-0.5 text-10 text-secondary outline-none"
              >
                {durations.map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
              <span className="text-10 text-placeholder">·</span>
              <select
                value={data.cameraMove || "push-in"}
                disabled={isRunning}
                onChange={(e) => patch({ cameraMove: e.target.value })}
                className="h-6 border-0 bg-transparent px-0.5 text-10 text-secondary outline-none"
              >
                {CAMERA_MOVES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>

              <div className="ml-auto flex items-center gap-0.5">
                {isDone && (
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("fs-canvas-promote", { detail: { id, media: "video" } })
                      )
                    }
                    className="h-6 rounded-md px-1.5 text-10 text-secondary hover:bg-layer-transparent-hover"
                  >
                    封面落图
                  </button>
                )}
                {isRunning ? (
                  <button
                    type="button"
                    onClick={cancelGenerate}
                    className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-10 text-secondary"
                  >
                    <Square className="size-2.5 fill-current" />
                    取消
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!draft.trim()}
                    onClick={runGenerate}
                    className={cn(
                      "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-10 font-medium transition-colors duration-150 ease-out",
                      !draft.trim()
                        ? "cursor-not-allowed text-placeholder"
                        : "bg-ai-primary text-on-color hover:bg-ai-primary-hover"
                    )}
                  >
                    <Sparkles className="size-3" strokeWidth={1.75} />
                    {isDone ? "再生成" : "生成"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const VideoGenNode = memo(VideoGenNodeComponent);
