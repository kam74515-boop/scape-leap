/**
 * 墙体几何运算（参考 blueprint-js Corner/Wall 与 arcada WallNode 交互）
 * - 端点拖拽拉长
 * - 墙体整体平移
 * - 端点吸附 / 共点联动
 * - 定长拉伸、分割、新增
 */
import type { SpaceWall } from "./space-model-store";

/** 端点吸附阈值（mm），接近 arcada 0.3m 的量级 */
export const WALL_SNAP_MM = 120;
/** 最短墙长 */
export const WALL_MIN_LEN_MM = 100;

export type WallEnd = "start" | "end";

export type SnapResult = {
  x: number;
  y: number;
  snapped: boolean;
  /** 吸附到的其它墙端点 */
  source?: { wallId: string; end: WallEnd };
};

export function wallLength(w: Pick<SpaceWall, "x1" | "y1" | "x2" | "y2">): number {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
}

export function wallMid(w: Pick<SpaceWall, "x1" | "y1" | "x2" | "y2">): { x: number; y: number } {
  return { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 };
}

export function wallAngleDeg(w: Pick<SpaceWall, "x1" | "y1" | "x2" | "y2">): number {
  let deg = (Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

export function getEnd(w: SpaceWall, end: WallEnd): { x: number; y: number } {
  return end === "start" ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
}

export function withEnd(w: SpaceWall, end: WallEnd, x: number, y: number): SpaceWall {
  if (end === "start") return { ...w, x1: Math.round(x), y1: Math.round(y) };
  return { ...w, x2: Math.round(x), y2: Math.round(y) };
}

/** 点到线段距离（mm） */
export function distPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { dist: number; t: number; cx: number; cy: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) {
    return { dist: Math.hypot(px - x1, py - y1), t: 0, cx: x1, cy: y1 };
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return { dist: Math.hypot(px - cx, py - cy), t, cx, cy };
}

/** 吸附到其它墙端点；可选轴对齐（shift 时） */
export function snapPoint(
  x: number,
  y: number,
  walls: SpaceWall[],
  opts?: {
    excludeWallId?: string;
    excludeEnd?: WallEnd;
    snapMm?: number;
    /** 轴对齐参考点（拖起点） */
    axisFrom?: { x: number; y: number };
    axisAlign?: boolean;
  }
): SnapResult {
  let sx = x;
  let sy = y;
  if (opts?.axisAlign && opts.axisFrom) {
    const adx = Math.abs(x - opts.axisFrom.x);
    const ady = Math.abs(y - opts.axisFrom.y);
    if (adx > ady) sy = opts.axisFrom.y;
    else sx = opts.axisFrom.x;
  }

  const tol = opts?.snapMm ?? WALL_SNAP_MM;
  let best: SnapResult = { x: Math.round(sx), y: Math.round(sy), snapped: false };
  let bestD = tol;

  for (const w of walls) {
    if (opts?.excludeWallId && w.id === opts.excludeWallId) {
      // 仍可吸附自身另一端以外的墙；跳过 excludeEnd
      const ends: WallEnd[] = ["start", "end"];
      for (const end of ends) {
        if (opts.excludeEnd === end) continue;
        // skip self entirely when excluding wall for cross-wall snap only
      }
      continue;
    }
    for (const end of ["start", "end"] as WallEnd[]) {
      if (w.id === opts?.excludeWallId && end === opts?.excludeEnd) continue;
      const p = getEnd(w, end);
      const d = Math.hypot(sx - p.x, sy - p.y);
      if (d <= bestD) {
        bestD = d;
        best = {
          x: p.x,
          y: p.y,
          snapped: true,
          source: { wallId: w.id, end },
        };
      }
    }
  }
  return best;
}

/**
 * 拖动端点：更新目标墙，并可选联动所有共点端点（blueprint-js corner move）
 */
export function moveWallEndpoint(
  walls: SpaceWall[],
  wallId: string,
  end: WallEnd,
  x: number,
  y: number,
  opts?: { linked?: boolean; snap?: boolean; axisAlign?: boolean }
): SpaceWall[] {
  const wall = walls.find((w) => w.id === wallId);
  if (!wall) return walls;

  const fixed = getEnd(wall, end === "start" ? "end" : "start");
  let nx = x;
  let ny = y;

  if (opts?.snap !== false) {
    const sn = snapPoint(x, y, walls, {
      excludeWallId: wallId,
      excludeEnd: end,
      axisFrom: fixed,
      axisAlign: opts?.axisAlign,
    });
    nx = sn.x;
    ny = sn.y;
  } else if (opts?.axisAlign) {
    const sn = snapPoint(x, y, walls, {
      excludeWallId: wallId,
      axisFrom: fixed,
      axisAlign: true,
      snapMm: 0,
    });
    nx = sn.x;
    ny = sn.y;
  }

  // 最短长度约束
  if (Math.hypot(nx - fixed.x, ny - fixed.y) < WALL_MIN_LEN_MM) {
    const dx = nx - fixed.x;
    const dy = ny - fixed.y;
    const len = Math.hypot(dx, dy) || 1;
    nx = fixed.x + (dx / len) * WALL_MIN_LEN_MM;
    ny = fixed.y + (dy / len) * WALL_MIN_LEN_MM;
  }

  const old = getEnd(wall, end);
  const linked = opts?.linked !== false;
  const eps = 1; // mm 共点判定

  return walls.map((w) => {
    if (w.id === wallId) return withEnd(w, end, nx, ny);
    if (!linked) return w;
    let next = w;
    if (Math.hypot(w.x1 - old.x, w.y1 - old.y) <= eps) {
      next = { ...next, x1: Math.round(nx), y1: Math.round(ny) };
    }
    if (Math.hypot(w.x2 - old.x, w.y2 - old.y) <= eps) {
      next = { ...next, x2: Math.round(nx), y2: Math.round(ny) };
    }
    return next;
  });
}

/** 整体平移墙段（arcada wall drag）；联动时端点共点一并移动 */
export function translateWall(
  walls: SpaceWall[],
  wallId: string,
  dx: number,
  dy: number,
  opts?: { linked?: boolean }
): SpaceWall[] {
  const wall = walls.find((w) => w.id === wallId);
  if (!wall) return walls;
  const rdx = Math.round(dx);
  const rdy = Math.round(dy);
  if (rdx === 0 && rdy === 0) return walls;

  const linked = opts?.linked !== false;
  const eps = 1;
  const s = { x: wall.x1, y: wall.y1 };
  const e = { x: wall.x2, y: wall.y2 };

  return walls.map((w) => {
    if (w.id === wallId) {
      return {
        ...w,
        x1: w.x1 + rdx,
        y1: w.y1 + rdy,
        x2: w.x2 + rdx,
        y2: w.y2 + rdy,
      };
    }
    if (!linked) return w;
    let next = { ...w };
    if (Math.hypot(w.x1 - s.x, w.y1 - s.y) <= eps || Math.hypot(w.x1 - e.x, w.y1 - e.y) <= eps) {
      // 仅当端点与被移墙端点重合时跟随
      if (Math.hypot(w.x1 - s.x, w.y1 - s.y) <= eps) {
        next = { ...next, x1: next.x1 + rdx, y1: next.y1 + rdy };
      } else if (Math.hypot(w.x1 - e.x, w.y1 - e.y) <= eps) {
        next = { ...next, x1: next.x1 + rdx, y1: next.y1 + rdy };
      }
    }
    if (Math.hypot(w.x2 - s.x, w.y2 - s.y) <= eps || Math.hypot(w.x2 - e.x, w.y2 - e.y) <= eps) {
      if (Math.hypot(w.x2 - s.x, w.y2 - s.y) <= eps) {
        next = { ...next, x2: next.x2 + rdx, y2: next.y2 + rdy };
      } else if (Math.hypot(w.x2 - e.x, w.y2 - e.y) <= eps) {
        next = { ...next, x2: next.x2 + rdx, y2: next.y2 + rdy };
      }
    }
    return next;
  });
}

/**
 * 定长：以中点为锚（默认）或固定 start/end 拉伸
 * blueprint 风格「改长度」
 */
export function setWallLength(
  walls: SpaceWall[],
  wallId: string,
  lengthMm: number,
  anchor: "center" | "start" | "end" = "center"
): SpaceWall[] {
  const wall = walls.find((w) => w.id === wallId);
  if (!wall) return walls;
  const len = Math.max(WALL_MIN_LEN_MM, lengthMm);
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const cur = Math.hypot(dx, dy) || 1;
  const ux = dx / cur;
  const uy = dy / cur;

  let x1 = wall.x1;
  let y1 = wall.y1;
  let x2 = wall.x2;
  let y2 = wall.y2;

  if (anchor === "start") {
    x2 = wall.x1 + ux * len;
    y2 = wall.y1 + uy * len;
  } else if (anchor === "end") {
    x1 = wall.x2 - ux * len;
    y1 = wall.y2 - uy * len;
  } else {
    const mid = wallMid(wall);
    x1 = mid.x - (ux * len) / 2;
    y1 = mid.y - (uy * len) / 2;
    x2 = mid.x + (ux * len) / 2;
    y2 = mid.y + (uy * len) / 2;
  }

  const next: SpaceWall = {
    ...wall,
    x1: Math.round(x1),
    y1: Math.round(y1),
    x2: Math.round(x2),
    y2: Math.round(y2),
  };

  // 联动：start 锚定时只联动 end 共点；center 时两端都动（简化：仅替换本墙）
  if (anchor === "center") {
    return walls.map((w) => (w.id === wallId ? next : w));
  }
  if (anchor === "start") {
    return moveWallEndpoint(walls, wallId, "end", next.x2, next.y2, { linked: true, snap: false });
  }
  return moveWallEndpoint(walls, wallId, "start", next.x1, next.y1, { linked: true, snap: false });
}

/** 沿墙方向增减长度（从中心） */
export function nudgeWallLength(
  walls: SpaceWall[],
  wallId: string,
  deltaMm: number
): SpaceWall[] {
  const wall = walls.find((w) => w.id === wallId);
  if (!wall) return walls;
  return setWallLength(walls, wallId, wallLength(wall) + deltaMm, "center");
}

export function setWallThickness(
  walls: SpaceWall[],
  wallId: string,
  thickness: number
): SpaceWall[] {
  const t = Math.max(40, Math.min(400, Math.round(thickness)));
  return walls.map((w) => (w.id === wallId ? { ...w, thickness: t } : w));
}

export function createWall(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  id?: string
): SpaceWall | null {
  if (Math.hypot(x2 - x1, y2 - y1) < WALL_MIN_LEN_MM) return null;
  return {
    id: id ?? `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    x1: Math.round(x1),
    y1: Math.round(y1),
    x2: Math.round(x2),
    y2: Math.round(y2),
    thickness,
  };
}

/** 在墙中点或 t∈(0,1) 处分割（arcada AddNode on wall） */
export function splitWall(
  walls: SpaceWall[],
  wallId: string,
  t = 0.5
): SpaceWall[] {
  const wall = walls.find((w) => w.id === wallId);
  if (!wall) return walls;
  const tt = Math.max(0.05, Math.min(0.95, t));
  const mx = wall.x1 + (wall.x2 - wall.x1) * tt;
  const my = wall.y1 + (wall.y2 - wall.y1) * tt;
  const a = createWall(wall.x1, wall.y1, mx, my, wall.thickness);
  const b = createWall(mx, my, wall.x2, wall.y2, wall.thickness);
  if (!a || !b) return walls;
  return [...walls.filter((w) => w.id !== wallId), a, b];
}

/** 命中检测：优先端点，其次墙身 */
export function hitTestWall(
  walls: SpaceWall[],
  x: number,
  y: number,
  opts?: { endHitMm?: number; bodyHitMm?: number }
): { wallId: string; kind: "start" | "end" | "body"; t?: number } | null {
  const endHit = opts?.endHitMm ?? 180;
  const bodyHit = opts?.bodyHitMm ?? 160;

  let bestEnd: { wallId: string; kind: "start" | "end"; d: number } | null = null;
  for (const w of walls) {
    const ds = Math.hypot(x - w.x1, y - w.y1);
    const de = Math.hypot(x - w.x2, y - w.y2);
    if (ds <= endHit && (!bestEnd || ds < bestEnd.d)) {
      bestEnd = { wallId: w.id, kind: "start", d: ds };
    }
    if (de <= endHit && (!bestEnd || de < bestEnd.d)) {
      bestEnd = { wallId: w.id, kind: "end", d: de };
    }
  }
  if (bestEnd) return { wallId: bestEnd.wallId, kind: bestEnd.kind };

  let bestBody: { wallId: string; t: number; d: number } | null = null;
  for (const w of walls) {
    const hit = distPointToSegment(x, y, w.x1, w.y1, w.x2, w.y2);
    const thr = Math.max(bodyHit, w.thickness);
    if (hit.dist <= thr && (!bestBody || hit.dist < bestBody.d)) {
      bestBody = { wallId: w.id, t: hit.t, d: hit.dist };
    }
  }
  if (bestBody) return { wallId: bestBody.wallId, kind: "body", t: bestBody.t };
  return null;
}

/**
 * 由中心线 + 厚度生成矩形四角（任意角度；坐标单位不限，px/mm 皆可）
 * 用于识别结果手工修正后重建墙多边形
 */
export function rectFromCenterline(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number
): [number, number][] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (thickness / 2);
  const ny = (dx / len) * (thickness / 2);
  return [
    [x1 + nx, y1 + ny],
    [x2 + nx, y2 + ny],
    [x2 - nx, y2 - ny],
    [x1 - nx, y1 - ny],
  ];
}

/**
 * 前端真导出 OBJ：每段墙（中心线 + 厚度 + 墙高）挤出为长方体网格。
 * 单位米；Y 轴向上（x=x_mm, y=高度, z=y_mm）。
 */
export function buildWallsObj(
  walls: Pick<SpaceWall, "x1" | "y1" | "x2" | "y2" | "thickness">[],
  wallHeightMm: number,
  name = "scapeleap-walls"
): string {
  const h = Math.max(100, wallHeightMm) / 1000;
  const lines: string[] = [
    `# ScapeLeap 构境AI 白模导出（墙体挤出）`,
    `# 白模精度用于可视化与布局决策，施工尺寸以实测为准`,
    `o ${name}`,
  ];
  let vBase = 0;
  let n = 0;
  for (const w of walls) {
    if (wallLength(w) < WALL_MIN_LEN_MM) continue;
    n += 1;
    const corners = rectFromCenterline(w.x1, w.y1, w.x2, w.y2, Math.max(40, w.thickness));
    // 底面 4 点 + 顶面 4 点（米）
    const bottom = corners.map(([x, y]) => [x / 1000, 0, y / 1000] as const);
    const top = corners.map(([x, y]) => [x / 1000, h, y / 1000] as const);
    lines.push(`g wall_${n}`);
    for (const [x, y, z] of [...bottom, ...top]) {
      lines.push(`v ${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)}`);
    }
    const i = (k: number) => vBase + k + 1; // OBJ 顶点 1-based
    // 底、顶、四侧（quad 面）
    lines.push(`f ${i(3)} ${i(2)} ${i(1)} ${i(0)}`);
    lines.push(`f ${i(4)} ${i(5)} ${i(6)} ${i(7)}`);
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      lines.push(`f ${i(k)} ${i(k2)} ${i(k2 + 4)} ${i(k + 4)}`);
    }
    vBase += 8;
  }
  return lines.join("\n") + "\n";
}

/** 画墙预览时吸附 + 正交 */
export function resolveDrawPoint(
  x: number,
  y: number,
  walls: SpaceWall[],
  from?: { x: number; y: number } | null,
  axisAlign = false
): SnapResult {
  return snapPoint(x, y, walls, {
    axisFrom: from ?? undefined,
    axisAlign: axisAlign && !!from,
  });
}
