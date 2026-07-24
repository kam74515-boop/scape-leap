/**
 * 图片生成节点 — 成熟 AIGC 画布能力（Demo 模拟）
 * - 比例自适应预览 + 圆角选中环
 * - 多图结果网格 / 点选主图
 * - 参考图上传 · 质量 · 算力预估 · 取消 · 转图片 / 用作参考
 */
import { memo, useEffect, useRef, useState } from "react";
import { type Node, type NodeProps, NodeResizer } from "@xyflow/react";
import { ImageIcon, Loader2, Plus, Sparkles, Square, Upload, X } from "@/icons";
import { cn } from "@plane/utils";
import { useCanvasNodeActions } from "../canvas-node-actions";
import type { ImageGenNodeData, ImageGenResult } from "../types";
import {
  ASPECT_RATIOS,
  IMAGE_COUNTS,
  IMAGE_MODELS,
  IMAGE_QUALITIES,
  estimateImageCredits,
  modelById,
  sizeForAspect,
} from "../models/catalog";
import { SKILLS_BY_ID } from "../skills/registry";
import { newId } from "../use-canvas-document";

type ImageGenNodeType = Node<ImageGenNodeData, "imagegen">;

const DEMO_REF_COLORS = [
  ["#F5F0E8", "#D4C4B0", "#8B7355"],
  ["#E8EEF5", "#A8C0D8", "#5A7A9A"],
  ["#EDE9FE", "#C4B5FD", "#8B5CF6"],
];

const RESIZER_LINE = "!border-0 !opacity-0";
const RESIZER_HANDLE =
  "!h-1.5 !w-1.5 !rounded-full !border !border-accent-primary !bg-surface-1 !shadow-sm";

function ImageGenNodeComponent({ id, data: raw, selected }: NodeProps<ImageGenNodeType>) {
  const data: ImageGenNodeData = {
    ...raw,
    aspect: raw.aspect || "1:1",
    count: raw.count || 1,
    quality: raw.quality || "standard",
    refs: raw.refs ?? [],
    selectedResultIndex: raw.selectedResultIndex ?? 0,
  };
  const { patchNodeData } = useCanvasNodeActions();
  const [draft, setDraft] = useState(data.prompt);
  const [showNeg, setShowNeg] = useState(!!data.negativePrompt);
  const [negDraft, setNegDraft] = useState(data.negativePrompt ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const isRunning = data.status === "running" || data.status === "queued";
  const isDone = data.status === "done";
  const isError = data.status === "error";
  const skillName = data.skillId ? SKILLS_BY_ID[data.skillId]?.name : null;
  const model = modelById(data.model);
  const credits = estimateImageCredits(data.model, data.count || 1, data.quality || "standard");
  const size = sizeForAspect(data.aspect || "1:1", 240);
  const results = data.results ?? [];
  const sel = Math.min(data.selectedResultIndex ?? 0, Math.max(0, results.length - 1));
  const primary: ImageGenResult | undefined = results[sel];

  useEffect(() => {
    setDraft(data.prompt);
  }, [data.prompt]);
  useEffect(() => {
    setNegDraft(data.negativePrompt ?? "");
  }, [data.negativePrompt]);

  const patch = (partial: Partial<ImageGenNodeData>) => {
    patchNodeData(id, partial);
  };

  const addRefFromFile = (file: File) => {
    if ((data.refs?.length ?? 0) >= (model?.maxRefs ?? 4)) return;
    const url = URL.createObjectURL(file);
    const colors = DEMO_REF_COLORS[(data.refs?.length ?? 0) % DEMO_REF_COLORS.length];
    patch({
      refs: [
        ...(data.refs ?? []),
        {
          id: newId("ref"),
          title: file.name.replace(/\.[^.]+$/, "") || "参考",
          colors,
          src: url,
        },
      ],
    });
  };

  const addDemoRef = () => {
    if ((data.refs?.length ?? 0) >= (model?.maxRefs ?? 4)) return;
    const colors = DEMO_REF_COLORS[(data.refs?.length ?? 0) % DEMO_REF_COLORS.length];
    patch({
      refs: [
        ...(data.refs ?? []),
        { id: newId("ref"), title: `参考 ${(data.refs?.length ?? 0) + 1}`, colors },
      ],
    });
  };

  const removeRef = (refId: string) => {
    patch({ refs: (data.refs ?? []).filter((r) => r.id !== refId) });
  };

  const runGenerate = () => {
    const promptText = draft.trim() || skillName || "生成图";
    if (isRunning) return;
    // 技能节点可无用户提示词直接跑（Demo mock）
    if (!draft.trim() && !data.skillId) return;
    patch({
      prompt: promptText,
      negativePrompt: negDraft.trim() || undefined,
    });
    window.dispatchEvent(new CustomEvent("fs-canvas-generate", { detail: { id, media: "image" } }));
  };

  const cancelGenerate = () => {
    window.dispatchEvent(new CustomEvent("fs-canvas-cancel", { detail: { id, media: "image" } }));
  };

  const selectResult = (index: number) => {
    const r = results[index];
    if (!r) return;
    patch({
      selectedResultIndex: index,
      resultColors: r.colors,
      resultTitle: r.title,
      seed: r.seed,
    });
  };

  const promote = (mode: "selected" | "all" = "selected") => {
    window.dispatchEvent(
      new CustomEvent("fs-canvas-promote", {
        detail: { id, media: "image", mode, resultIndex: sel },
      })
    );
  };

  const usePrimaryAsRef = () => {
    if (!primary) return;
    if ((data.refs?.length ?? 0) >= (model?.maxRefs ?? 4)) return;
    patch({
      refs: [
        ...(data.refs ?? []),
        {
          id: newId("ref"),
          title: primary.title.slice(0, 12) || "结果参考",
          colors: primary.colors,
          src: primary.src,
        },
      ],
    });
  };

  return (
    <div className="relative" style={{ width: size.width, fontFamily: "inherit" }}>
      <div className="pointer-events-none absolute -top-5 left-1 right-1 flex items-center gap-1 text-[10px] font-medium text-tertiary">
        <ImageIcon className="size-2.5 shrink-0" strokeWidth={2} />
        <span className="min-w-0 truncate">{skillName || "图片生成器"}</span>
        <span className="ml-auto shrink-0 text-[9px] text-placeholder">
          {data.aspect} · {credits} CU
        </span>
      </div>

      <NodeResizer
        isVisible={selected}
        minWidth={140}
        minHeight={140}
        keepAspectRatio
        lineClassName={RESIZER_LINE}
        handleClassName={RESIZER_HANDLE}
      />

      {/* 预览区：比例自适应 + 圆角选中环 */}
      <div
        className={cn(
          "relative flex w-full items-center justify-center overflow-hidden rounded-xl border bg-surface-1 transition-[box-shadow,border-color]",
          selected
            ? "border-accent-primary/40 shadow-[0_0_0_2px_var(--bg-accent-primary)]"
            : "border-subtle",
          isRunning &&
            !selected &&
            "border-accent-primary/50 shadow-[0_0_0_2px_color-mix(in_srgb,var(--bg-accent-primary)_25%,transparent)]"
        )}
        style={{ height: size.height }}
      >
        {isDone && results.length > 1 ? (
          <ResultGrid results={results} selected={sel} onSelect={selectResult} />
        ) : isDone && (primary || data.resultColors) ? (
          <div
            className="relative size-full"
            style={
              primary?.src
                ? undefined
                : {
                    background: `linear-gradient(145deg, ${(primary?.colors || data.resultColors || ["#E5E5E5"]).join(",")})`,
                  }
            }
          >
            {primary?.src ? (
              <img
                src={primary.src}
                alt={primary.title || data.resultTitle || "生成结果"}
                className="size-full object-cover"
                draggable={false}
              />
            ) : null}
            {(primary?.title || data.resultTitle) && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-1.5">
                <div className="truncate text-11 font-medium text-white">
                  {primary?.title || data.resultTitle}
                </div>
                {primary?.seed != null && (
                  <div className="text-[9px] text-white/70">seed {primary.seed}</div>
                )}
              </div>
            )}
          </div>
        ) : isRunning ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <Loader2 className="size-7 animate-spin text-accent-primary" />
            <span className="text-11 text-tertiary">
              {data.status === "queued" ? "排队中…" : `生成中 ${data.progress ?? 0}%`}
            </span>
            <div className="h-1 w-28 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent-primary transition-all"
                style={{ width: `${data.progress ?? 8}%` }}
              />
            </div>
            <button
              type="button"
              className="nodrag mt-0.5 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-tertiary hover:bg-layer-transparent-hover hover:text-secondary"
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
          <div className="flex flex-col items-center gap-2 px-3 text-center">
            <div className="text-11 text-danger-primary">{data.error || "生成失败"}</div>
            <button
              type="button"
              className="nodrag rounded-md bg-accent-subtle px-2 py-1 text-[10px] font-medium text-accent-primary"
              onClick={(e) => {
                e.stopPropagation();
                runGenerate();
              }}
            >
              重试
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 px-4 text-center">
            <ImageIcon className="size-12 text-placeholder opacity-40" strokeWidth={1.2} />
            <span className="text-[10px] text-placeholder">选中后输入提示词生成</span>
          </div>
        )}
      </div>

      {/* PromptDock */}
      {selected && (
        <div
          className="nodrag nopan nowheel absolute left-1/2 top-[calc(100%+10px)] z-20 w-[min(360px,92vw)] -translate-x-1/2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="overflow-hidden rounded-xl border border-subtle bg-surface-1 shadow-md">
            {/* 参考图 */}
            <div className="flex items-center gap-1 px-2 pt-2">
              {(data.refs ?? []).map((r) => (
                <div
                  key={r.id}
                  className="group relative size-6 shrink-0 overflow-hidden rounded-md bg-surface-2"
                  title={r.title}
                >
                  {r.src ? (
                    <img src={r.src} alt="" className="size-full object-cover" />
                  ) : (
                    <div
                      className="size-full"
                      style={{ background: `linear-gradient(135deg, ${r.colors.join(",")})` }}
                    />
                  )}
                  <button
                    type="button"
                    className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRef(r.id);
                    }}
                  >
                    <X className="size-2.5 text-white" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                title="上传参考图"
                onClick={(e) => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-placeholder hover:bg-layer-transparent-hover hover:text-secondary"
              >
                <Upload className="size-3" />
              </button>
              <button
                type="button"
                title="添加示意参考"
                onClick={(e) => {
                  e.stopPropagation();
                  addDemoRef();
                }}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-placeholder hover:bg-layer-transparent-hover hover:text-secondary"
              >
                <Plus className="size-3" />
              </button>
              <span className="ml-0.5 text-[9px] text-placeholder">
                参考 {(data.refs?.length ?? 0)}/{model?.maxRefs ?? 4}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) addRefFromFile(f);
                  e.target.value = "";
                }}
              />
            </div>

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
              placeholder="描述画面：空间、材质、光线、镜头…"
              className="w-full resize-none border-0 bg-transparent px-2.5 py-1.5 text-11 leading-snug text-primary outline-none placeholder:text-placeholder disabled:opacity-60"
            />

            {showNeg && (
              <textarea
                value={negDraft}
                rows={1}
                disabled={isRunning}
                onChange={(e) => setNegDraft(e.target.value)}
                onBlur={() => patch({ negativePrompt: negDraft.trim() || undefined })}
                placeholder="负向提示：排除的元素…"
                className="w-full resize-none border-0 border-t border-subtle/60 bg-transparent px-2.5 py-1 text-[10px] leading-snug text-secondary outline-none placeholder:text-placeholder"
              />
            )}

            <div className="flex flex-wrap items-center gap-0.5 border-t border-subtle/80 px-1.5 py-1">
              <select
                value={data.model}
                disabled={isRunning}
                onChange={(e) => patch({ model: e.target.value })}
                className="h-6 max-w-[6.5rem] min-w-0 truncate border-0 bg-transparent px-1 text-[10px] text-secondary outline-none hover:text-primary"
              >
                {IMAGE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <Dot />
              <select
                value={data.aspect || "1:1"}
                disabled={isRunning}
                onChange={(e) => patch({ aspect: e.target.value })}
                className="h-6 border-0 bg-transparent px-0.5 text-[10px] text-secondary outline-none hover:text-primary"
              >
                {ASPECT_RATIOS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <Dot />
              <select
                value={String(data.count || 1)}
                disabled={isRunning}
                onChange={(e) => patch({ count: Number(e.target.value) })}
                className="h-6 border-0 bg-transparent px-0.5 text-[10px] text-secondary outline-none hover:text-primary"
              >
                {IMAGE_COUNTS.map((c) => (
                  <option key={c} value={c}>
                    {c}张
                  </option>
                ))}
              </select>
              <Dot />
              <select
                value={data.quality || "standard"}
                disabled={isRunning}
                onChange={(e) =>
                  patch({ quality: e.target.value as ImageGenNodeData["quality"] })
                }
                className="h-6 border-0 bg-transparent px-0.5 text-[10px] text-secondary outline-none hover:text-primary"
              >
                {IMAGE_QUALITIES.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title="负向提示词"
                onClick={() => setShowNeg((v) => !v)}
                className={cn(
                  "ml-0.5 h-6 rounded px-1 text-[10px]",
                  showNeg ? "text-accent-primary" : "text-placeholder hover:text-secondary"
                )}
              >
                −提示
              </button>

              <div className="ml-auto flex items-center gap-0.5">
                {isDone && (
                  <>
                    <button
                      type="button"
                      title="结果用作参考"
                      onClick={(e) => {
                        e.stopPropagation();
                        usePrimaryAsRef();
                      }}
                      className="h-6 rounded-md px-1.5 text-[10px] text-secondary hover:bg-layer-transparent-hover"
                    >
                      作参考
                    </button>
                    {results.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          promote("all");
                        }}
                        className="h-6 rounded-md px-1.5 text-[10px] text-secondary hover:bg-layer-transparent-hover"
                      >
                        全落图
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        promote("selected");
                      }}
                      className="h-6 rounded-md px-1.5 text-[10px] text-secondary hover:bg-layer-transparent-hover"
                    >
                      落图
                    </button>
                  </>
                )}
                {isRunning ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelGenerate();
                    }}
                    className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium text-secondary hover:bg-layer-transparent-hover"
                  >
                    <Square className="size-2.5 fill-current" />
                    取消
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!draft.trim() && !data.skillId}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      runGenerate();
                    }}
                    className={cn(
                      "inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium",
                      !draft.trim() && !data.skillId
                        ? "cursor-not-allowed text-placeholder"
                        : "bg-accent-primary text-on-color hover:opacity-90"
                    )}
                  >
                    <Sparkles className="size-3" />
                    {isDone ? "再生成" : "生成"}
                    <span className="opacity-70">{credits}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="mt-1 text-center text-[9px] text-placeholder">⌘↵ 生成</div>
        </div>
      )}
    </div>
  );
}

function Dot() {
  return <span className="text-[10px] text-placeholder">·</span>;
}

function ResultGrid({
  results,
  selected,
  onSelect,
}: {
  results: ImageGenResult[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  const n = results.length;
  const cols = n <= 1 ? 1 : 2;
  return (
    <div
      className="grid size-full gap-0.5 p-0.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {results.map((r, i) => (
        <button
          key={r.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(i);
          }}
          className={cn(
            "relative min-h-0 overflow-hidden rounded-md",
            selected === i ? "ring-2 ring-accent-primary ring-offset-1 ring-offset-surface-1" : "opacity-90"
          )}
          style={
            r.src
              ? undefined
              : { background: `linear-gradient(145deg, ${r.colors.join(",")})` }
          }
          title={r.title}
        >
          {r.src ? (
            <img src={r.src} alt={r.title} className="size-full object-cover" draggable={false} />
          ) : null}
          <span className="absolute bottom-0.5 left-0.5 rounded bg-black/40 px-1 text-[8px] text-white">
            {i + 1}
          </span>
        </button>
      ))}
    </div>
  );
}

export const ImageGenNode = memo(ImageGenNodeComponent);
