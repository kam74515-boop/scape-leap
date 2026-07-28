/**
 * 构境 AI · 局部改图蒙版壳（Demo）
 * 涂选区 → mask dataURL → 父级 mock 落图（非正式 inpainting）
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Paintbrush, Sparkles, X } from "lucide-react";
import { cn } from "@plane/utils";

export type MaskEditTarget = {
  nodeId: string;
  title: string;
  src?: string;
  colors: string[];
  skillId?: string;
};

type Props = {
  target: MaskEditTarget;
  onClose: () => void;
  onConfirm: (payload: {
    nodeId: string;
    maskDataUrl: string;
    instruction: string;
    skillId?: string;
  }) => void;
};

const CANVAS_W = 520;
const CANVAS_H = 390;

export function MaskEditOverlay({ target, onClose, onConfirm }: Props) {
  const paintRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [brush, setBrush] = useState(28);
  const [mode, setMode] = useState<"paint" | "erase">("paint");
  const [instruction, setInstruction] = useState("更通透 · 提亮选区");
  const [hasMask, setHasMask] = useState(false);

  const clearMask = useCallback(() => {
    const c = paintRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasMask(false);
  }, []);

  useEffect(() => {
    clearMask();
  }, [target.nodeId, clearMask]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = paintRef.current!;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width;
    const sy = c.height / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  const stroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = paintRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brush;
    if (mode === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(239, 68, 68, 0.55)";
    }
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasMask(true);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = paintRef.current?.getContext("2d");
    if (ctx) {
      const { x, y } = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    stroke(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    stroke(e);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    paintRef.current?.getContext("2d")?.beginPath();
  };

  const confirm = () => {
    const c = paintRef.current;
    if (!c) return;
    const exportC = document.createElement("canvas");
    exportC.width = c.width;
    exportC.height = c.height;
    const ex = exportC.getContext("2d");
    const src = c.getContext("2d");
    if (!ex || !src) return;
    ex.fillStyle = "#000";
    ex.fillRect(0, 0, exportC.width, exportC.height);
    const img = src.getImageData(0, 0, c.width, c.height);
    const out = ex.getImageData(0, 0, exportC.width, exportC.height);
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] > 20) {
        out.data[i] = 255;
        out.data[i + 1] = 255;
        out.data[i + 2] = 255;
        out.data[i + 3] = 255;
      }
    }
    ex.putImageData(out, 0, 0);
    onConfirm({
      nodeId: target.nodeId,
      maskDataUrl: exportC.toDataURL("image/png"),
      instruction: instruction.trim() || "局部改图",
      skillId: target.skillId,
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div
        className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-subtle bg-surface-1 shadow-overlay-200"
        role="dialog"
        aria-label="构境局部改图"
      >
        <div className="flex items-center gap-2 border-b border-subtle px-3 py-2">
          <Paintbrush className="size-3.5 text-accent-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-12 font-semibold text-primary">局部改图</div>
            <div className="truncate text-10 text-tertiary">
              {target.title} · 涂选区域后生成（构境 Demo 蒙版）
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-tertiary hover:bg-layer-transparent-hover"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          className="relative mx-auto mt-3 overflow-hidden rounded-lg border border-subtle bg-surface-2"
          style={{ width: CANVAS_W, height: CANVAS_H, maxWidth: "100%" }}
        >
          {target.src ? (
            <img
              src={target.src}
              alt=""
              className="absolute inset-0 size-full object-cover"
              draggable={false}
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(145deg, ${target.colors.join(",")})` }}
            />
          )}
          <canvas
            ref={paintRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="absolute inset-0 size-full cursor-crosshair touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
          <button
            type="button"
            onClick={() => setMode("paint")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-10 font-medium",
              mode === "paint"
                ? "bg-accent-subtle text-accent-primary"
                : "text-secondary hover:bg-layer-transparent-hover"
            )}
          >
            <Paintbrush className="size-3" />
            画笔
          </button>
          <button
            type="button"
            onClick={() => setMode("erase")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-10 font-medium",
              mode === "erase"
                ? "bg-accent-subtle text-accent-primary"
                : "text-secondary hover:bg-layer-transparent-hover"
            )}
          >
            <Eraser className="size-3" />
            擦除
          </button>
          <label className="ml-1 flex items-center gap-1.5 text-10 text-tertiary">
            粗细
            <input
              type="range"
              min={8}
              max={64}
              value={brush}
              onChange={(e) => setBrush(Number(e.target.value))}
              className="w-20"
            />
          </label>
          <button
            type="button"
            onClick={clearMask}
            className="rounded-md px-2 py-1 text-10 text-secondary hover:bg-layer-transparent-hover"
          >
            清空
          </button>
        </div>

        <div className="px-3 pt-2">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="描述选区怎么改，如：换成橡木地板"
            className="w-full rounded-md border border-subtle bg-surface-1 px-2.5 py-1.5 text-11 text-primary outline-none placeholder:text-placeholder focus:border-accent-primary"
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-3 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-11 font-medium text-secondary hover:bg-layer-transparent-hover"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!hasMask}
            onClick={confirm}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-11 font-medium transition-all duration-150 ease-out",
              hasMask
                ? "bg-ai-primary text-on-color hover:-translate-y-px hover:brightness-105"
                : "cursor-not-allowed bg-surface-2 text-placeholder"
            )}
          >
            <Sparkles className="size-3.5" strokeWidth={1.75} />
            生成选区
          </button>
        </div>
      </div>
    </div>
  );
}
