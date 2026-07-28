/**
 * 识别结果预览（YOLO 三模型融合）
 * - 2D：优先用用户原图 + source_polygons（清晰）；否则高清 content + canvas 多边形
 *   修正模式：点选删除误检墙/门/窗、拖拽墙段端点、改墙厚（写回 store，3D 与统计同步）
 * - 3D：canvas 多边形按墙高挤出（three.js，配色随 --fs-plan-* 主题变量）
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { cn } from "@plane/utils";
import {
  moveDetectedWallEndpoint,
  planPxPerMm,
  removeDetectedItem,
  setDetectedWallThickness,
  type DetectKind,
  type F23dPlan,
  type F23dRingPoly,
  type SpacePlacement,
  type SpaceWall,
} from "./space-model-store";
import { rectFromCenterline, type WallEnd } from "./space-wall-ops";
import { FsButton } from "./ui";

/** --fs-plan-* 语义色（light/dark 双主题，见 variables.css）；SVG 属性不支持 var()，统一走 style */
const PLAN = {
  bg: "var(--fs-plan-bg)",
  surface: "var(--fs-plan-surface)",
  wall: "var(--fs-plan-wall)",
  wallSoft: "var(--fs-plan-wall-soft)",
  door: "var(--fs-plan-door)",
  window: "var(--fs-plan-window)",
  label: "var(--fs-plan-label)",
  accent: "var(--fs-plan-accent)",
};

type Props = {
  plan: F23dPlan;
  mode: "2d" | "3d";
  /** 用户上传原图 data URL，2D 底图优先用它（最清晰） */
  originalUrl?: string | null;
  /** 当前可见墙中心线（mm）；修正模式的端点拖拽依赖它 */
  walls?: SpaceWall[];
  widthMm?: number;
  /** 墙高 mm（3D 挤出与 OBJ 导出共用） */
  wallHeightMm?: number;
  /** 修正模式：点选删除 + 拖端点 + 改厚度 */
  editMode?: boolean;
  /** 图块布局（mm 坐标，与场景 walls 同源） */
  placements?: SpacePlacement[];
  onRemovePlacement?: (id: string) => void;
  className?: string;
};

export function F23dPlanViewer({
  plan,
  mode,
  originalUrl,
  walls,
  widthMm,
  wallHeightMm,
  editMode,
  placements,
  onRemovePlacement,
  className,
}: Props) {
  if (mode === "3d") {
    return <F23dThreeView plan={plan} wallHeightMm={wallHeightMm} className={className} />;
  }
  return (
    <F23dSvgOverlay
      plan={plan}
      originalUrl={originalUrl}
      walls={walls}
      widthMm={widthMm}
      editMode={editMode}
      placements={placements}
      onRemovePlacement={onRemovePlacement}
      className={className}
    />
  );
}

function polyPath(outer: number[][], holes: number[][][]) {
  const ring = (pts: number[][]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + " Z";
  let d = ring(outer);
  for (const h of holes ?? []) d += " " + ring(h);
  return d;
}

type Selected = { kind: DetectKind; id: string } | null;

type EndpointDrag = {
  wallId: string;
  end: WallEnd;
  /** 拖动中的端点（渲染空间 px） */
  px: { x: number; y: number };
};

function F23dSvgOverlay({
  plan,
  originalUrl,
  walls,
  widthMm,
  editMode,
  placements,
  onRemovePlacement,
  className,
}: {
  plan: F23dPlan;
  originalUrl?: string | null;
  walls?: SpaceWall[];
  widthMm?: number;
  editMode?: boolean;
  placements?: SpacePlacement[];
  onRemovePlacement?: (id: string) => void;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [drag, setDrag] = useState<EndpointDrag | null>(null);
  const dragRef = useRef<EndpointDrag | null>(null);

  const [L, T, iw, ih] = plan.content_rect as number[];
  const sourceSize = plan.source_size as number[] | undefined;
  const sourcePolys = plan.source_polygons;

  // 几何坐标在服务端 deskew/增强图上 → 必须优先 preview_full，
  // 勿叠未校正的 originalUrl（会造成位移/错位）
  const fullFromServer = plan.preview_full_b64
    ? `data:image/png;base64,${plan.preview_full_b64}`
    : null;
  const contentSrc = plan.input_image_b64
    ? `data:image/png;base64,${plan.input_image_b64}`
    : null;

  const useSourceSpace =
    Boolean(sourcePolys && (sourceSize?.[0] ?? 0) > 0 && (sourceSize?.[1] ?? 0) > 0) &&
    Boolean(fullFromServer || originalUrl);

  const src = useSourceSpace
    ? fullFromServer || originalUrl
    : contentSrc || fullFromServer || originalUrl;

  const vb = useSourceSpace
    ? { x: 0, y: 0, w: sourceSize![0], h: sourceSize![1] }
    : { x: L, y: T, w: iw, h: ih };

  const polys = useSourceSpace
    ? {
        wall: sourcePolys!.wall ?? [],
        door: sourcePolys!.door ?? [],
        window: sourcePolys!.window ?? [],
      }
    : {
        wall: plan.polygons.wall ?? [],
        door: plan.polygons.door ?? [],
        window: plan.polygons.window ?? [],
      };

  const sw = useSourceSpace ? Math.max(1, (sourceSize?.[0] ?? 1000) / 900) : 1;

  // mm ↔ 渲染空间 px 换算（修正模式用；kx=0 表示无法换算，禁用端点拖拽）
  const srcPxPerMm = widthMm ? planPxPerMm(plan, widthMm) : 0;
  const cScale =
    (sourceSize?.[0] ?? 0) > 0 && iw > 0 ? iw / (sourceSize?.[0] ?? 1) : 0;
  const kx = useSourceSpace ? srcPxPerMm : srcPxPerMm * cScale;
  const off = useSourceSpace ? { x: 0, y: 0 } : { x: L, y: T };
  const mmToPx = useCallback(
    (x: number, y: number) => ({ x: off.x + x * kx, y: off.y + y * kx }),
    [off.x, off.y, kx]
  );
  const pxToMm = useCallback(
    (x: number, y: number) => ({ x: (x - off.x) / (kx || 1), y: (y - off.y) / (kx || 1) }),
    [off.x, off.y, kx]
  );

  const clientToPx = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const sp = pt.matrixTransform(ctm.inverse());
    return { x: sp.x, y: sp.y };
  }, []);

  const wallById = useMemo(() => {
    const m = new Map<string, SpaceWall>();
    for (const w of walls ?? []) m.set(w.id, w);
    return m;
  }, [walls]);

  const canEditWalls = Boolean(editMode && kx > 0 && walls?.length);

  useEffect(() => {
    if (!editMode) {
      setSelected(null);
      setDrag(null);
      dragRef.current = null;
    }
  }, [editMode]);

  // 修正模式键盘：Delete 删所选 · Esc 取消选择
  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        removeDetectedItem(selected.kind, selected.id);
        setSelected(null);
      }
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editMode, selected]);

  const handlePointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const p = clientToPx(e.clientX, e.clientY);
    const next = { ...d, px: p };
    dragRef.current = next;
    setDrag(next);
  };

  const commitDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    const mm = pxToMm(d.px.x, d.px.y);
    moveDetectedWallEndpoint(d.wallId, d.end, mm.x, mm.y);
  };

  const pickPoly = (kind: DetectKind, p: F23dRingPoly) => {
    if (!editMode || !p.id) return;
    setSelected((cur) => (cur?.id === p.id ? null : { kind, id: p.id! }));
  };

  const isSel = (p: F23dRingPoly) => Boolean(editMode && p.id && selected?.id === p.id);

  /** 拖拽中的墙：本地实时重建矩形（渲染空间 px），松手才写回 store */
  const dragOverride = useMemo(() => {
    if (!drag) return null;
    const w = wallById.get(drag.wallId);
    if (!w) return null;
    const a = drag.end === "start" ? pxToMm(drag.px.x, drag.px.y) : { x: w.x1, y: w.y1 };
    const b = drag.end === "end" ? pxToMm(drag.px.x, drag.px.y) : { x: w.x2, y: w.y2 };
    const p1 = mmToPx(a.x, a.y);
    const p2 = mmToPx(b.x, b.y);
    return {
      wallId: drag.wallId,
      outer: rectFromCenterline(p1.x, p1.y, p2.x, p2.y, Math.max(2, w.thickness * kx)),
      p1,
      p2,
    };
  }, [drag, wallById, pxToMm, mmToPx, kx]);

  const renderWalls = (list: F23dRingPoly[] | undefined) =>
    (list ?? []).map((p, i) => {
      const hollow = p.kind === "hollow";
      const sel = isSel(p);
      const outer =
        dragOverride && p.id === dragOverride.wallId
          ? (dragOverride.outer as number[][])
          : (p.outer as number[][]);
      return (
        <path
          key={p.id ?? `wall-${i}`}
          d={polyPath(outer, (p.holes as number[][][]) ?? [])}
          style={{
            fill: sel ? PLAN.accent : hollow ? PLAN.wallSoft : PLAN.wall,
            stroke: sel ? PLAN.accent : hollow ? PLAN.wallSoft : PLAN.wall,
          }}
          fillOpacity={hollow ? 0.55 : sel ? 0.9 : 1}
          strokeOpacity={1}
          strokeWidth={hollow ? sw * 1.4 : sw}
          fillRule="evenodd"
          className={editMode ? "cursor-pointer" : undefined}
          onClick={
            editMode
              ? (e) => {
                  e.stopPropagation();
                  pickPoly("wall", p);
                }
              : undefined
          }
        />
      );
    });

  /** 门：开启扇形（半透明）+ 门扇线，不是墙同宽实心条 */
  const renderDoors = (list: F23dRingPoly[] | undefined) =>
    (list ?? []).map((p, i) => {
      const outer = (p.outer as number[][]) ?? [];
      const leaf = (p as { leaf?: number[][] }).leaf;
      const sel = isSel(p);
      const color = sel ? PLAN.accent : PLAN.door;
      return (
        <g
          key={p.id ?? `door-${i}`}
          className={editMode ? "cursor-pointer" : undefined}
          onClick={
            editMode
              ? (e) => {
                  e.stopPropagation();
                  pickPoly("door", p);
                }
              : undefined
          }
        >
          <path
            d={polyPath(outer, [])}
            style={{ fill: color, stroke: color }}
            fillOpacity={sel ? 0.45 : 0.28}
            strokeOpacity={1}
            strokeWidth={sw * 1.6}
            fillRule="evenodd"
          />
          {leaf && leaf.length >= 2 && (
            <line
              x1={leaf[0][0]}
              y1={leaf[0][1]}
              x2={leaf[1][0]}
              y2={leaf[1][1]}
              style={{ stroke: color }}
              strokeWidth={sw * 2.2}
              strokeLinecap="round"
            />
          )}
        </g>
      );
    });

  /** 窗：细条半透明，描边更醒目，避免与墙同宽实心 */
  const renderWindows = (list: F23dRingPoly[] | undefined) =>
    (list ?? []).map((p, i) => {
      const sel = isSel(p);
      const color = sel ? PLAN.accent : PLAN.window;
      return (
        <path
          key={p.id ?? `win-${i}`}
          d={polyPath(p.outer as number[][], (p.holes as number[][][]) ?? [])}
          style={{ fill: color, stroke: color }}
          fillOpacity={sel ? 0.6 : 0.45}
          strokeOpacity={1}
          strokeWidth={sw * 1.5}
          fillRule="evenodd"
          className={editMode ? "cursor-pointer" : undefined}
          onClick={
            editMode
              ? (e) => {
                  e.stopPropagation();
                  pickPoly("window", p);
                }
              : undefined
          }
        />
      );
    });

  const selectedWall =
    selected?.kind === "wall" ? wallById.get(selected.id) ?? null : null;
  const handles =
    canEditWalls && selectedWall
      ? {
          a:
            dragOverride?.wallId === selectedWall.id
              ? dragOverride.p1
              : mmToPx(selectedWall.x1, selectedWall.y1),
          b:
            dragOverride?.wallId === selectedWall.id
              ? dragOverride.p2
              : mmToPx(selectedWall.x2, selectedWall.y2),
        }
      : null;
  const handleR = sw * 6;

  const startDrag = (end: WallEnd) => (e: RPointerEvent<SVGGElement>) => {
    if (!selectedWall) return;
    e.stopPropagation();
    const p = clientToPx(e.clientX, e.clientY);
    const d: EndpointDrag = { wallId: selectedWall.id, end, px: p };
    dragRef.current = d;
    setDrag(d);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  return (
    <div
      className={cn("absolute inset-0 flex items-center justify-center", className)}
      style={{ background: PLAN.bg }}
    >
      <svg
        ref={svgRef}
        className={cn("max-h-full max-w-full", editMode && "touch-none")}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={editMode ? () => setSelected(null) : undefined}
        onPointerMove={editMode ? handlePointerMove : undefined}
        onPointerUp={editMode ? commitDrag : undefined}
        onPointerLeave={editMode ? commitDrag : undefined}
      >
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} style={{ fill: PLAN.surface }} />
        {src && (
          <image
            href={src}
            x={vb.x}
            y={vb.y}
            width={vb.w}
            height={vb.h}
            preserveAspectRatio="none"
            opacity={0.5}
          />
        )}
        {/* 墙不透明；门窗符号化（开启弧/细窗带） */}
        {renderWalls(polys.wall)}
        {renderDoors(polys.door)}
        {renderWindows(polys.window)}
        {/* 图块布局（mm → 渲染空间 px） */}
        {kx > 0 &&
          (placements ?? []).map((pl) => {
            const a = mmToPx(pl.x, pl.y);
            const w = pl.wMm * kx;
            const h = pl.dMm * kx;
            return (
              <g key={pl.id}>
                <rect
                  x={a.x}
                  y={a.y}
                  width={w}
                  height={h}
                  rx={Math.max(2, sw * 2)}
                  fill={pl.color}
                  opacity={0.55}
                  style={{ stroke: PLAN.label }}
                  strokeWidth={sw * 0.6}
                  className={onRemovePlacement ? "cursor-pointer" : undefined}
                  onClick={
                    onRemovePlacement
                      ? (e) => {
                          e.stopPropagation();
                          onRemovePlacement(pl.id);
                        }
                      : undefined
                  }
                />
                <text
                  x={a.x + w / 2}
                  y={a.y + h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fill: PLAN.label }}
                  fontSize={Math.max(10, sw * 8)}
                  className="pointer-events-none select-none"
                >
                  {pl.label}
                </text>
              </g>
            );
          })}
        {handles && (
          <g>
            <line
              x1={handles.a.x}
              y1={handles.a.y}
              x2={handles.b.x}
              y2={handles.b.y}
              style={{ stroke: PLAN.accent }}
              strokeWidth={sw}
              strokeDasharray={`${sw * 4} ${sw * 3}`}
              className="pointer-events-none"
              opacity={0.9}
            />
            <g className="cursor-grab" onPointerDown={startDrag("start")}>
              <circle cx={handles.a.x} cy={handles.a.y} r={handleR * 2} fill="transparent" />
              <circle
                cx={handles.a.x}
                cy={handles.a.y}
                r={handleR}
                style={{ fill: PLAN.surface, stroke: PLAN.accent }}
                strokeWidth={sw * 1.6}
              />
            </g>
            <g className="cursor-grab" onPointerDown={startDrag("end")}>
              <circle cx={handles.b.x} cy={handles.b.y} r={handleR * 2} fill="transparent" />
              <circle
                cx={handles.b.x}
                cy={handles.b.y}
                r={handleR}
                style={{ fill: PLAN.surface, stroke: PLAN.accent }}
                strokeWidth={sw * 1.6}
              />
            </g>
          </g>
        )}
      </svg>

      {editMode && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-subtle bg-surface-1/95 py-1.5 pl-4 pr-2 shadow-overlay-100">
          {selected ? (
            <>
              <span className="text-11 text-secondary">
                已选{selected.kind === "wall" ? "墙段" : selected.kind === "door" ? "门" : "窗"}
              </span>
              {selectedWall && (
                <label className="flex items-center gap-1 text-11 text-tertiary">
                  墙厚
                  <input
                    type="number"
                    min={40}
                    max={400}
                    step={10}
                    defaultValue={Math.round(selectedWall.thickness)}
                    key={selectedWall.id}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v !== selectedWall.thickness) {
                        setDetectedWallThickness(selectedWall.id, v);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="w-14 rounded-md border border-subtle bg-surface-1 px-1.5 py-0.5 text-11 text-primary tabular-nums outline-none focus:border-accent-strong"
                  />
                  mm
                </label>
              )}
              <FsButton
                variant="danger"
                size="sm"
                onClick={() => {
                  removeDetectedItem(selected.kind, selected.id);
                  setSelected(null);
                }}
              >
                删除误检
              </FsButton>
            </>
          ) : (
            <span className="pr-2 text-11 text-tertiary">
              点选误检的墙 / 门 / 窗即可删除；选中墙后可拖两端圆点、改墙厚
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** 从多边形点集算轴对齐包围盒（像素坐标） */
function polyBounds(lists: (F23dRingPoly[] | undefined)[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let n = 0;
  for (const list of lists) {
    for (const poly of list ?? []) {
      for (const p of poly.outer ?? []) {
        if (!p || p.length < 2) continue;
        minX = Math.min(minX, p[0]);
        minY = Math.min(minY, p[1]);
        maxX = Math.max(maxX, p[0]);
        maxY = Math.max(maxY, p[1]);
        n++;
      }
    }
  }
  if (!n || !Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
}

/** 读取 --fs-plan-* 主题色（three.js 不认 CSS 变量，需转具体色值） */
function readPlanThemeColors() {
  const fallback = {
    bg: "#ece8e1",
    surface: "#f6f3ee",
    wall: "#28282d",
    wallSoft: "#4a4a52",
    door: "#e8833a",
    window: "#4a90d9",
  };
  if (typeof window === "undefined") return fallback;
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  return {
    bg: read("--fs-plan-bg", fallback.bg),
    surface: read("--fs-plan-surface", fallback.surface),
    wall: read("--fs-plan-wall", fallback.wall),
    wallSoft: read("--fs-plan-wall-soft", fallback.wallSoft),
    door: read("--fs-plan-door", fallback.door),
    window: read("--fs-plan-window", fallback.window),
  };
}

function F23dThreeView({
  plan,
  wallHeightMm,
  className,
}: {
  plan: F23dPlan;
  wallHeightMm?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // 主题切换（data-theme 变化）时重建场景，保证 dark 适配
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const mo = new MutationObserver(() => setThemeTick((t) => t + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    if (document.body) {
      mo.observe(document.body, { attributes: true, attributeFilter: ["data-theme", "class"] });
    }
    return () => mo.disconnect();
  }, []);

  const geomKey = useMemo(() => {
    const w = plan.polygons.wall?.length ?? 0;
    const d = plan.polygons.door?.length ?? 0;
    const win = plan.polygons.window?.length ?? 0;
    // 手工修正（拖端点/改厚度）不改数量，只改坐标——校验和保证 3D 跟着重建
    let checksum = 0;
    for (const list of [plan.polygons.wall, plan.polygons.door, plan.polygons.window]) {
      for (const poly of list ?? []) {
        const p0 = poly.outer?.[0];
        if (p0 && p0.length >= 2) checksum += Number(p0[0]) + Number(p0[1]) * 7;
      }
    }
    return `${w}-${d}-${win}-${checksum.toFixed(2)}-${plan.content_rect?.join(",")}`;
  }, [plan]);

  useEffect(() => {
    let disposed = false;
    let renderer: { dispose: () => void; domElement: HTMLCanvasElement } | null = null;
    let ro: ResizeObserver | null = null;
    let raf = 0;

    const run = async () => {
      setErr(null);
      setReady(false);
      const el = hostRef.current;
      if (!el) return;

      // 禁止裸 import("three")：Vite 在 transform 阶段会解析并炸页（包未安装时）
      // 仅用 CDN + @vite-ignore
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let THREE: any;
      try {
        THREE = await import(
          /* @vite-ignore */ "https://esm.sh/three@0.170.0"
        );
      } catch (e) {
        if (!disposed) setErr(`Three.js 加载失败：${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      if (disposed || !hostRef.current) return;

      const host = hostRef.current;
      host.innerHTML = "";

      const colors = readPlanThemeColors();
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(colors.bg);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
      const rend = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      rend.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      host.appendChild(rend.domElement);
      renderer = rend;

      // 世界根节点：建完 mesh 后整体挪到原点，保证画面居中
      const root = new THREE.Group();
      scene.add(root);

      const light = new THREE.DirectionalLight(0xffffff, 1.1);
      light.position.set(4, 10, 6);
      scene.add(light);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));

      const [L, T, iw, ih] = plan.content_rect as number[];
      // 优先用墙体真实包围盒居中（户型常偏在图一侧）；无几何时退回 content_rect
      const bb =
        polyBounds([plan.polygons.wall, plan.polygons.door, plan.polygons.window]) ??
        ({
          minX: L,
          minY: T,
          maxX: L + iw,
          maxY: T + ih,
          cx: L + iw / 2,
          cy: T + ih / 2,
          w: iw,
          h: ih,
        } as const);
      const cx = bb.cx;
      const cy = bb.cy;
      // 略加边距，避免贴边；不要用整图画布 span（会把模型缩到角落）
      const span = Math.max(bb.w, bb.h, iw * 0.15, ih * 0.15, 32);
      const scale = 8 / span;

      // 墙高接通：wall_height_mm → canvas px → world（无比例信息时退 0.9）
      const hMm = wallHeightMm ?? plan.wall_height_mm ?? 2800;
      const mmPerSrcPx = Number(plan.scale?.mm_per_px) || 0;
      const srcW = Number(plan.source_size?.[0]) || 0;
      const cPerSrc = srcW > 0 && iw > 0 ? iw / srcW : 0;
      const wallH =
        mmPerSrcPx > 0 && cPerSrc > 0 ? (hMm / mmPerSrcPx) * cPerSrc * scale : 0.9;

      const matWall = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colors.wall),
        roughness: 0.85,
        metalness: 0.05,
      });
      const matWallSoft = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colors.wallSoft),
        roughness: 0.85,
        metalness: 0.05,
      });
      const matDoor = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colors.door),
        roughness: 0.7,
        metalness: 0.05,
      });
      const matWin = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colors.window),
        roughness: 0.55,
        metalness: 0.1,
        transparent: true,
        opacity: 0.75,
      });

      const extrude = (
        polys: F23dRingPoly[] | undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        matOf: (poly: F23dRingPoly) => any,
        height: number
      ) => {
        for (const poly of polys ?? []) {
          const outer = poly.outer as number[][];
          if (!outer || outer.length < 3) continue;
          const shape = new THREE.Shape();
          outer.forEach((p, i) => {
            const sx = (p[0] - cx) * scale;
            const sy = (p[1] - cy) * scale;
            if (i === 0) shape.moveTo(sx, -sy);
            else shape.lineTo(sx, -sy);
          });
          for (const hole of poly.holes ?? []) {
            const hpts = hole as number[][];
            if (hpts.length < 3) continue;
            const path = new THREE.Path();
            hpts.forEach((p, i) => {
              const sx = (p[0] - cx) * scale;
              const sy = (p[1] - cy) * scale;
              if (i === 0) path.moveTo(sx, -sy);
              else path.lineTo(sx, -sy);
            });
            shape.holes.push(path);
          }
          const geo = new THREE.ExtrudeGeometry(shape, {
            depth: height,
            bevelEnabled: false,
          });
          // 挤出沿 +Z，顶点在 z∈[0,height]；绕 X -90° 后高度在 +Y，平面在 XZ
          geo.translate(0, 0, 0);
          const mesh = new THREE.Mesh(geo, matOf(poly));
          mesh.rotation.x = -Math.PI / 2;
          root.add(mesh);
        }
      };

      extrude(plan.polygons.wall, (p) => (p.kind === "hollow" ? matWallSoft : matWall), wallH);
      extrude(plan.polygons.door, () => matDoor, wallH * 0.75);
      extrude(plan.polygons.window, () => matWin, wallH * 0.55);

      // 用真实 mesh 包围盒再微调：水平居中 + 底面贴 y=0（不要把墙埋进地板）
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      if (!box.isEmpty()) {
        box.getCenter(center);
        box.getSize(size);
        root.position.set(-center.x, -box.min.y, -center.z);
        root.updateMatrixWorld(true);
      } else {
        size.set(span * scale, wallH, span * scale);
      }

      // 地板贴包围盒，居中
      const floorW = Math.max(size.x, size.z, 1) * 1.25;
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(floorW, floorW),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.surface), roughness: 0.95 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.01;
      scene.add(floor);

      // 相机：按模型尺寸 fit，orbit 围绕世界原点（模型中心）
      const maxDim = Math.max(size.x, size.y, size.z, 1);
      const fov = (camera.fov * Math.PI) / 180;
      const fitDist = (maxDim * 0.55) / Math.tan(fov / 2);
      const dist = Math.max(fitDist * 1.15, maxDim * 1.6, 4);
      const lookY = Math.max(size.y * 0.35, wallH * 0.35);
      const camY = Math.max(dist * 0.55, size.y * 1.2, 2.5);

      const resize = () => {
        if (!hostRef.current || !renderer) return;
        const w = hostRef.current.clientWidth;
        const h = hostRef.current.clientHeight;
        camera.aspect = w / Math.max(h, 1);
        camera.updateProjectionMatrix();
        rend.setSize(w, h, false);
      };
      resize();
      ro = new ResizeObserver(resize);
      ro.observe(host);

      let ang = 0.55;
      const tick = () => {
        if (disposed) return;
        ang += 0.004;
        const r = dist * 0.92;
        camera.position.set(Math.cos(ang) * r, camY, Math.sin(ang) * r);
        camera.lookAt(0, lookY, 0);
        rend.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();
      if (!disposed) setReady(true);
    };

    void run();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      if (renderer) {
        try {
          renderer.dispose();
          renderer.domElement.remove();
        } catch {
          /* ignore */
        }
      }
    };
  }, [geomKey, plan, wallHeightMm, themeTick]);

  return (
    <div className={cn("absolute inset-0", className)} style={{ background: PLAN.bg }}>
      <div ref={hostRef} className="absolute inset-0" />
      {!ready && !err && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-12 text-tertiary">
          加载 3D…
        </div>
      )}
      {err && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-12 text-danger-primary">
          {err}
        </div>
      )}
    </div>
  );
}
