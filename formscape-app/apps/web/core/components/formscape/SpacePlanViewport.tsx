/**
 * 2D 平面编辑视口
 * 参考 arcada Wall/WallNode + blueprint-js Corner/WallView2D：
 * 选墙 · 端点拉长 · 墙身平移 · 画墙链 · 长度标注 · 端点吸附
 */
import { useCallback, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { cn } from "@plane/utils";
import type { SpacePlacement, SpaceScene, SpaceWall } from "./space-model-store";
import {
  hitTestWall,
  moveWallEndpoint,
  resolveDrawPoint,
  translateWall,
  wallAngleDeg,
  wallLength,
  wallMid,
  type WallEnd,
} from "./space-wall-ops";

export type PlanTool = "select" | "draw-wall";

type DragState =
  | {
      kind: "endpoint";
      wallId: string;
      end: WallEnd;
      axisFrom: { x: number; y: number };
    }
  | {
      kind: "wall-move";
      wallId: string;
      origin: { x: number; y: number };
      startWall: { x1: number; y1: number; x2: number; y2: number };
      baseWalls: SpaceWall[];
    }
  | {
      kind: "block";
      id: string;
      ox: number;
      oy: number;
    }
  | null;

type Props = {
  scene: SpaceScene;
  editTarget: "wall" | "block";
  tool: PlanTool;
  selectedPlacementId: string | null;
  selectedWallId: string | null;
  onSelectPlacement: (id: string | null) => void;
  onSelectWall: (id: string | null) => void;
  onMoveBlock: (id: string, x: number, y: number) => void;
  onWallsChange: (walls: SpaceWall[], message?: string) => void;
  onAddWall: (x1: number, y1: number, x2: number, y2: number) => void;
  onToolChange: (t: PlanTool) => void;
};

export function SpacePlanViewport({
  scene,
  editTarget,
  tool,
  selectedPlacementId,
  selectedWallId,
  onSelectPlacement,
  onSelectWall,
  onMoveBlock,
  onWallsChange,
  onAddWall,
  onToolChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState>(null);
  const movedRef = useRef(false);
  const [drawFrom, setDrawFrom] = useState<{ x: number; y: number } | null>(null);
  const [cursorMm, setCursorMm] = useState<{ x: number; y: number } | null>(null);
  const [snapHint, setSnapHint] = useState<{ x: number; y: number } | null>(null);

  const pad = 400;
  const vbW = scene.widthMm + pad * 2;
  const vbH = scene.depthMm + pad * 2;

  const clientToMm = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const sp = pt.matrixTransform(ctm.inverse());
    return { x: sp.x - pad, y: sp.y - pad };
  }, []);

  const endDrag = () => {
    dragRef.current = null;
    setSnapHint(null);
  };

  const handlePointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const mm = clientToMm(e.clientX, e.clientY);
    setCursorMm(mm);
    const axisAlign = e.shiftKey;
    const d = dragRef.current;

    if (d?.kind === "endpoint") {
      movedRef.current = true;
      const next = moveWallEndpoint(scene.walls, d.wallId, d.end, mm.x, mm.y, {
        linked: true,
        snap: true,
        axisAlign,
      });
      const others = scene.walls.filter((w) => w.id !== d.wallId);
      const sn = resolveDrawPoint(mm.x, mm.y, others, d.axisFrom, axisAlign);
      setSnapHint(sn.snapped ? { x: sn.x, y: sn.y } : null);
      onWallsChange(next);
      return;
    }

    if (d?.kind === "wall-move") {
      const dx = mm.x - d.origin.x;
      const dy = mm.y - d.origin.y;
      if (Math.hypot(dx, dy) > 2) movedRef.current = true;
      const base = d.baseWalls.map((w) =>
        w.id === d.wallId
          ? {
              ...w,
              x1: d.startWall.x1,
              y1: d.startWall.y1,
              x2: d.startWall.x2,
              y2: d.startWall.y2,
            }
          : w
      );
      onWallsChange(translateWall(base, d.wallId, dx, dy, { linked: true }));
      return;
    }

    if (d?.kind === "block") {
      movedRef.current = true;
      const x = Math.max(0, Math.min(scene.widthMm - 100, mm.x - d.ox));
      const y = Math.max(0, Math.min(scene.depthMm - 100, mm.y - d.oy));
      onMoveBlock(d.id, Math.round(x), Math.round(y));
      return;
    }

    if (tool === "draw-wall") {
      const sn = resolveDrawPoint(mm.x, mm.y, scene.walls, drawFrom, axisAlign);
      setSnapHint(sn.snapped || axisAlign ? { x: sn.x, y: sn.y } : null);
      setCursorMm({ x: sn.x, y: sn.y });
    }
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (dragRef.current) return;
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    const mm = clientToMm(e.clientX, e.clientY);

    if (tool === "draw-wall") {
      const sn = resolveDrawPoint(mm.x, mm.y, scene.walls, drawFrom, e.shiftKey);
      if (!drawFrom) {
        setDrawFrom({ x: sn.x, y: sn.y });
        return;
      }
      onAddWall(drawFrom.x, drawFrom.y, sn.x, sn.y);
      setDrawFrom({ x: sn.x, y: sn.y });
      return;
    }

    if (editTarget === "wall") {
      const hit = hitTestWall(scene.walls, mm.x, mm.y);
      if (hit) {
        onSelectWall(hit.wallId);
        onSelectPlacement(null);
        return;
      }
    }
    onSelectPlacement(null);
    onSelectWall(null);
  };

  const previewEnd =
    tool === "draw-wall" && drawFrom && cursorMm
      ? resolveDrawPoint(cursorMm.x, cursorMm.y, scene.walls, drawFrom, false)
      : null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md border border-subtle bg-surface-1/95 p-0.5 shadow-sm">
        <ToolBtn
          active={tool === "select"}
          onClick={() => {
            onToolChange("select");
            setDrawFrom(null);
          }}
          label="选择"
        />
        <ToolBtn
          active={tool === "draw-wall"}
          onClick={() => {
            onToolChange("draw-wall");
            onSelectPlacement(null);
            setDrawFrom(null);
          }}
          label="画墙"
        />
        {tool === "draw-wall" && drawFrom && (
          <button
            type="button"
            className="rounded px-2 py-1 text-[10px] text-tertiary hover:bg-surface-2"
            onClick={() => setDrawFrom(null)}
          >
            结束链
          </button>
        )}
      </div>

      <svg
        ref={svgRef}
        className="size-full touch-none"
        viewBox={`${-pad} ${-pad} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClick={handleBackgroundClick}
      >
        <rect x={-pad} y={-pad} width={vbW} height={vbH} className="fill-surface-2" />
        <rect
          x={0}
          y={0}
          width={scene.widthMm}
          height={scene.depthMm}
          className="fill-surface-1 stroke-subtle"
          strokeWidth={20}
        />
        {scene.floorPlanDataUrl && (
          <image
            href={scene.floorPlanDataUrl}
            x={0}
            y={0}
            width={scene.widthMm}
            height={scene.depthMm}
            opacity={0.35}
            preserveAspectRatio="none"
          />
        )}

        {scene.walls.map((w) => {
          const active = w.id === selectedWallId;
          const len = wallLength(w);
          const mid = wallMid(w);
          const ang = wallAngleDeg(w);
          const labelAng = ang > 90 && ang < 270 ? ang + 180 : ang;
          return (
            <g key={w.id}>
              <line
                x1={w.x1}
                y1={w.y1}
                x2={w.x2}
                y2={w.y2}
                stroke="transparent"
                strokeWidth={Math.max(w.thickness * 2.5, 220)}
                strokeLinecap="square"
                className={tool === "draw-wall" ? "pointer-events-none" : "cursor-move"}
                onPointerDown={(e) => {
                  if (tool !== "select" || editTarget !== "wall") return;
                  e.stopPropagation();
                  onSelectWall(w.id);
                  onSelectPlacement(null);
                  const mm = clientToMm(e.clientX, e.clientY);
                  dragRef.current = {
                    kind: "wall-move",
                    wallId: w.id,
                    origin: mm,
                    startWall: { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 },
                    baseWalls: scene.walls.map((x) => ({ ...x })),
                  };
                  (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (movedRef.current) {
                    movedRef.current = false;
                    return;
                  }
                  if (tool === "select") onSelectWall(active ? null : w.id);
                }}
              />
              <line
                x1={w.x1}
                y1={w.y1}
                x2={w.x2}
                y2={w.y2}
                stroke={active ? "#6366f1" : "#334155"}
                strokeWidth={active ? w.thickness * 1.35 : w.thickness}
                strokeLinecap="square"
                className="pointer-events-none"
              />
              {(active || len > 800) && (
                <g transform={`translate(${mid.x}, ${mid.y}) rotate(${labelAng})`}>
                  <rect
                    x={-220}
                    y={-90}
                    width={440}
                    height={140}
                    rx={20}
                    fill={active ? "#eef2ff" : "rgba(255,255,255,0.85)"}
                    stroke={active ? "#6366f1" : "#cbd5e1"}
                    strokeWidth={8}
                    className="pointer-events-none"
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    y={-20}
                    fontSize={110}
                    fill={active ? "#4338ca" : "#475569"}
                    className="pointer-events-none"
                  >
                    {(len / 1000).toFixed(2)}m
                  </text>
                </g>
              )}
              {active && tool === "select" && editTarget === "wall" && (
                <>
                  <EndpointHandle
                    x={w.x1}
                    y={w.y1}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      dragRef.current = {
                        kind: "endpoint",
                        wallId: w.id,
                        end: "start",
                        axisFrom: { x: w.x2, y: w.y2 },
                      };
                      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                    }}
                  />
                  <EndpointHandle
                    x={w.x2}
                    y={w.y2}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      dragRef.current = {
                        kind: "endpoint",
                        wallId: w.id,
                        end: "end",
                        axisFrom: { x: w.x1, y: w.y1 },
                      };
                      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                    }}
                  />
                </>
              )}
            </g>
          );
        })}

        {drawFrom && previewEnd && (
          <g className="pointer-events-none">
            <line
              x1={drawFrom.x}
              y1={drawFrom.y}
              x2={previewEnd.x}
              y2={previewEnd.y}
              stroke="#6366f1"
              strokeWidth={scene.wallThicknessMm}
              strokeDasharray="80 60"
              opacity={0.85}
            />
            <circle cx={drawFrom.x} cy={drawFrom.y} r={70} fill="#6366f1" />
            <circle
              cx={previewEnd.x}
              cy={previewEnd.y}
              r={70}
              fill="none"
              stroke="#6366f1"
              strokeWidth={24}
            />
            <text
              x={(drawFrom.x + previewEnd.x) / 2}
              y={(drawFrom.y + previewEnd.y) / 2 - 120}
              textAnchor="middle"
              fontSize={120}
              fill="#4338ca"
            >
              {(Math.hypot(previewEnd.x - drawFrom.x, previewEnd.y - drawFrom.y) / 1000).toFixed(2)}m
            </text>
          </g>
        )}

        {snapHint && (
          <circle
            cx={snapHint.x}
            cy={snapHint.y}
            r={90}
            fill="none"
            stroke="#22c55e"
            strokeWidth={28}
            className="pointer-events-none"
          />
        )}

        {scene.placements.map((pl) => (
          <BlockShape
            key={pl.id}
            pl={pl}
            active={pl.id === selectedPlacementId}
            disabled={tool === "draw-wall"}
            onPointerDown={(e) => {
              if (tool !== "select") return;
              e.stopPropagation();
              onSelectPlacement(pl.id);
              onSelectWall(null);
              const mm = clientToMm(e.clientX, e.clientY);
              dragRef.current = { kind: "block", id: pl.id, ox: mm.x - pl.x, oy: mm.y - pl.y };
              (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
            }}
          />
        ))}
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-3 max-w-[min(90%,28rem)] rounded-md bg-surface-1/90 px-2 py-1 text-11 text-tertiary shadow-sm">
        {tool === "draw-wall"
          ? "画墙：单击起点→终点 · 链式续画 · Shift 正交 · 端点吸附 ·「结束链」停止"
          : editTarget === "wall"
            ? "拖端点拉长 · 拖墙身平移 · 共点联动 · Shift 正交 · 右侧改数值长度"
            : "拖拽图块 · 切「墙段」编辑墙体"}
      </div>
    </div>
  );
}

function ToolBtn({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-2.5 py-1 text-11 font-medium",
        active ? "bg-accent-primary text-on-color" : "text-secondary hover:bg-surface-2"
      )}
    >
      {label}
    </button>
  );
}

function EndpointHandle({
  x,
  y,
  onPointerDown,
}: {
  x: number;
  y: number;
  onPointerDown: (e: RPointerEvent) => void;
}) {
  const r = 95;
  return (
    <g className="cursor-nwse-resize" onPointerDown={onPointerDown} onClick={(e) => e.stopPropagation()}>
      <circle cx={x} cy={y} r={r + 40} fill="transparent" />
      <circle cx={x} cy={y} r={r} fill="#fff" stroke="#6366f1" strokeWidth={28} />
      <circle cx={x} cy={y} r={36} fill="#6366f1" />
    </g>
  );
}

function BlockShape({
  pl,
  active,
  disabled,
  onPointerDown,
}: {
  pl: SpacePlacement;
  active: boolean;
  disabled?: boolean;
  onPointerDown: (e: RPointerEvent) => void;
}) {
  const cx = pl.x + pl.wMm / 2;
  const cy = pl.y + pl.dMm / 2;
  return (
    <g
      transform={`rotate(${pl.rot} ${cx} ${cy})`}
      onPointerDown={disabled ? undefined : onPointerDown}
      className={disabled ? "pointer-events-none opacity-70" : "cursor-grab"}
    >
      <rect
        x={pl.x}
        y={pl.y}
        width={pl.wMm}
        height={pl.dMm}
        fill={pl.color}
        opacity={0.88}
        stroke={active ? "#6366f1" : "#0f172a"}
        strokeWidth={active ? 40 : 16}
        rx={40}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={Math.min(220, pl.wMm / 5)}
        fill="#0f172a"
        opacity={0.75}
        className="pointer-events-none"
      >
        {pl.label}
      </text>
    </g>
  );
}
