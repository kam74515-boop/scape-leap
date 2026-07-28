/**
 * 等轴测 3D 墙体视口（与 2D 同源 walls）
 * 选墙 · 显示长度 · 端点手柄示意（精确拉长建议在平面视图）
 * 参考 blueprint-js Viewer3d edge 挤出 + arcada 选中高亮
 */
import { Box } from "@/icons";
import type { SpaceScene } from "./space-model-store";
import { wallLength, wallMid } from "./space-wall-ops";

type Props = {
  scene: SpaceScene;
  selectedWallId: string | null;
  onSelectWall: (id: string | null) => void;
};

export function SpaceWall3DViewport({ scene, selectedWallId, onSelectWall }: Props) {
  const pad = 800;
  const scale = 0.045;
  const h = scene.wallHeightMm * scale;
  const cos = Math.cos(Math.PI / 6);
  const sin = Math.sin(Math.PI / 6);
  const project = (x: number, y: number, z: number) => {
    const X = (x - y) * cos;
    const Y = (x + y) * sin - z;
    return { X, Y };
  };

  const pts = scene.walls.flatMap((w) => [w.x1, w.y1, w.x2, w.y2]);
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  const sampleZ = [0, h];
  for (let i = 0; i < pts.length; i += 2) {
    for (const z of sampleZ) {
      const p = project(pts[i], pts[i + 1], z);
      minX = Math.min(minX, p.X);
      maxX = Math.max(maxX, p.X);
      minY = Math.min(minY, p.Y);
      maxY = Math.max(maxY, p.Y);
    }
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    maxX = 1000;
    minY = 0;
    maxY = 1000;
  }
  const vbW = maxX - minX + pad * 2;
  const vbH = maxY - minY + pad * 2;

  return (
    <div className="absolute inset-0 flex flex-col">
      <svg
        className="min-h-0 flex-1"
        viewBox={`${minX - pad} ${minY - pad} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={() => onSelectWall(null)}
      >
        {(() => {
          const c00 = project(0, 0, 0);
          const c10 = project(scene.widthMm, 0, 0);
          const c11 = project(scene.widthMm, scene.depthMm, 0);
          const c01 = project(0, scene.depthMm, 0);
          return (
            <polygon
              points={`${c00.X},${c00.Y} ${c10.X},${c10.Y} ${c11.X},${c11.Y} ${c01.X},${c01.Y}`}
              className="fill-surface-1 stroke-subtle"
              strokeWidth={20}
              opacity={0.95}
            />
          );
        })()}

        {scene.walls.map((w) => {
          const t = w.thickness;
          const active = w.id === selectedWallId;
          const a0 = project(w.x1, w.y1, 0);
          const a1 = project(w.x2, w.y2, 0);
          const b0 = project(w.x1, w.y1, h);
          const b1 = project(w.x2, w.y2, h);
          const dx = w.x2 - w.x1;
          const dy = w.y2 - w.y1;
          const len = Math.hypot(dx, dy) || 1;
          const nx = (-dy / len) * (t / 2);
          const ny = (dx / len) * (t / 2);
          const c0 = project(w.x1 + nx, w.y1 + ny, 0);
          const c1 = project(w.x2 + nx, w.y2 + ny, 0);
          const d0 = project(w.x1 + nx, w.y1 + ny, h);
          const d1 = project(w.x2 + nx, w.y2 + ny, h);
          const fill = active ? "var(--fs-plan-accent)" : "var(--neutral-1000)";
          const mid = wallMid(w);
          const label = project(mid.x, mid.y, h + 80);
          return (
            <g
              key={w.id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelectWall(active ? null : w.id);
              }}
            >
              <polygon
                points={`${a0.X},${a0.Y} ${a1.X},${a1.Y} ${b1.X},${b1.Y} ${b0.X},${b0.Y}`}
                fill={fill}
                opacity={0.88}
                stroke={active ? "var(--fs-plan-accent-strong)" : "var(--fs-plan-wall)"}
                strokeWidth={active ? 16 : 8}
              />
              <polygon
                points={`${a1.X},${a1.Y} ${c1.X},${c1.Y} ${d1.X},${d1.Y} ${b1.X},${b1.Y}`}
                fill={active ? "var(--fs-plan-accent-soft)" : "var(--neutral-800)"}
                opacity={0.75}
                stroke="var(--neutral-1100)"
                strokeWidth={6}
              />
              <polygon
                points={`${b0.X},${b0.Y} ${b1.X},${b1.Y} ${d1.X},${d1.Y} ${d0.X},${d0.Y}`}
                fill={active ? "var(--fs-plan-accent-subtle)" : "var(--neutral-700)"}
                opacity={0.9}
                stroke="var(--neutral-1000)"
                strokeWidth={6}
              />
              <line
                x1={c0.X}
                y1={c0.Y}
                x2={c1.X}
                y2={c1.Y}
                stroke="var(--neutral-1100)"
                strokeWidth={Math.max(12, t * 0.02)}
                opacity={0.5}
              />
              {active && (
                <>
                  <circle cx={a0.X} cy={a0.Y} r={55} fill="var(--fs-plan-surface)" stroke="var(--fs-plan-accent-strong)" strokeWidth={14} />
                  <circle cx={a1.X} cy={a1.Y} r={55} fill="var(--fs-plan-surface)" stroke="var(--fs-plan-accent-strong)" strokeWidth={14} />
                  <circle cx={b0.X} cy={b0.Y} r={40} fill="var(--fs-plan-accent)" />
                  <circle cx={b1.X} cy={b1.Y} r={40} fill="var(--fs-plan-accent)" />
                  <text
                    x={label.X}
                    y={label.Y}
                    textAnchor="middle"
                    fontSize={90}
                    fill="var(--fs-plan-accent-strong)"
                    fontWeight={600}
                  >
                    {(wallLength(w) / 1000).toFixed(2)}m
                  </text>
                </>
              )}
            </g>
          );
        })}

        {scene.placements.map((pl) => {
          const z = 400 * scale;
          const p = project(pl.x + pl.wMm / 2, pl.y + pl.dMm / 2, z);
          return (
            <rect
              key={pl.id}
              x={p.X - 80}
              y={p.Y - 50}
              width={160}
              height={100}
              fill={pl.color}
              opacity={0.85}
              stroke="var(--fs-plan-wall)"
              strokeWidth={6}
              rx={12}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-surface-1/90 px-2 py-1 text-11 text-tertiary shadow-sm">
        <Box className="size-3.5" />
        等轴测 · 与平面同源 · 点选墙段 · 拉长/画墙请切「平面」或右侧数值
      </div>
    </div>
  );
}
