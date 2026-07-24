"""
墙 mask / 二值图 → 墙段 + 几何清理

步骤（CubiCasa 系通用后处理）：
1. 形态学闭运算（补墙缝）
2. 骨架化 / 轮廓 → 直线段
3. 近端点吸附成角
4. 共线合并
5. 可疑短段标记（可选删除）
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class WallSeg:
    x1: float
    y1: float
    x2: float
    y2: float
    thickness: float = 120.0

    @property
    def length(self) -> float:
        return float(np.hypot(self.x2 - self.x1, self.y2 - self.y1))

    def as_dict(self) -> dict:
        return {
            "x1": round(self.x1, 1),
            "y1": round(self.y1, 1),
            "x2": round(self.x2, 1),
            "y2": round(self.y2, 1),
            "thickness": round(self.thickness, 1),
        }


def mask_to_walls(
    wall_mask: np.ndarray,
    *,
    width_mm: float,
    depth_mm: float,
    min_len_ratio: float = 0.03,
    snap_mm: float = 120.0,
    merge_angle_deg: float = 8.0,
    merge_dist_mm: float = 150.0,
    drop_short: bool = True,
    short_ratio: float = 0.04,
    default_thickness_mm: float = 120.0,
) -> tuple[list[WallSeg], dict]:
    """
    wall_mask: HxW uint8，非零=墙
    返回 mm 坐标墙段 + debug meta
    """
    h, w = wall_mask.shape[:2]
    if h < 4 or w < 4:
        return [], {"error": "mask too small"}

    sx = width_mm / w
    sy = depth_mm / h
    scale = (sx + sy) / 2.0

    m = (wall_mask > 0).astype(np.uint8) * 255
    # 闭运算补小缝
    k = max(3, int(round(min(h, w) * 0.008)) | 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k, k))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, kernel, iterations=1)

    # 估计墙厚（px）
    thick_px = _estimate_thickness_px(m)
    thick_mm = max(60.0, min(400.0, thick_px * scale))
    if default_thickness_mm:
        thick_mm = 0.6 * thick_mm + 0.4 * default_thickness_mm

    # LSD 直线检测（比 Hough 更适合建筑图）
    segs_px = _detect_lines_lsd(m)
    if len(segs_px) < 2:
        segs_px = _detect_lines_hough(m)

    min_len_px = max(8.0, min(h, w) * min_len_ratio)
    segs_px = [s for s in segs_px if s.length >= min_len_px]

    walls = [
        WallSeg(
            x1=s.x1 * sx,
            y1=s.y1 * sy,
            x2=s.x2 * sx,
            y2=s.y2 * sy,
            thickness=thick_mm,
        )
        for s in segs_px
    ]

    before = len(walls)
    walls = snap_endpoints(walls, snap_mm=snap_mm)
    walls = merge_collinear(walls, angle_deg=merge_angle_deg, dist_mm=merge_dist_mm)
    short_mm = max(200.0, min(width_mm, depth_mm) * short_ratio)
    suspicious = [i for i, ww in enumerate(walls) if ww.length < short_mm]
    if drop_short and suspicious:
        walls = [ww for i, ww in enumerate(walls) if i not in set(suspicious)]

    meta = {
        "mask_px": [int(w), int(h)],
        "scale_mm_per_px": {"x": sx, "y": sy},
        "thick_px": thick_px,
        "thick_mm": thick_mm,
        "raw_segments": before,
        "after_cleanup": len(walls),
        "dropped_short": len(suspicious) if drop_short else 0,
        "suspicious_short_ids": suspicious if not drop_short else [],
        "short_threshold_mm": short_mm,
    }
    return walls, meta


def snap_endpoints(walls: list[WallSeg], snap_mm: float = 120.0) -> list[WallSeg]:
    """近端点聚类到均值，形成角点（blueprint corner 近似）。"""
    if not walls:
        return walls
    pts: list[list[float]] = []
    for w in walls:
        pts.append([w.x1, w.y1])
        pts.append([w.x2, w.y2])
    pts_a = np.array(pts, dtype=np.float64)
    n = len(pts_a)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    thr2 = snap_mm * snap_mm
    for i in range(n):
        for j in range(i + 1, n):
            d2 = (pts_a[i, 0] - pts_a[j, 0]) ** 2 + (pts_a[i, 1] - pts_a[j, 1]) ** 2
            if d2 <= thr2:
                union(i, j)

    clusters: dict[int, list[int]] = {}
    for i in range(n):
        r = find(i)
        clusters.setdefault(r, []).append(i)

    new_pts = pts_a.copy()
    for idxs in clusters.values():
        if len(idxs) < 2:
            continue
        mean = pts_a[idxs].mean(axis=0)
        for i in idxs:
            new_pts[i] = mean

    out: list[WallSeg] = []
    for k, w in enumerate(walls):
        i0, i1 = 2 * k, 2 * k + 1
        x1, y1 = new_pts[i0]
        x2, y2 = new_pts[i1]
        if np.hypot(x2 - x1, y2 - y1) < 50:
            continue
        out.append(WallSeg(x1, y1, x2, y2, w.thickness))
    return out


def merge_collinear(
    walls: list[WallSeg],
    angle_deg: float = 8.0,
    dist_mm: float = 150.0,
) -> list[WallSeg]:
    """共线且端点邻近的墙合并成更长一段。"""
    if len(walls) < 2:
        return walls

    used = [False] * len(walls)
    out: list[WallSeg] = []
    ang_thr = np.deg2rad(angle_deg)

    def unit(w: WallSeg) -> np.ndarray:
        d = np.array([w.x2 - w.x1, w.y2 - w.y1], dtype=np.float64)
        n = np.linalg.norm(d)
        if n < 1e-6:
            return np.array([1.0, 0.0])
        return d / n

    for i, a in enumerate(walls):
        if used[i]:
            continue
        group = [a]
        used[i] = True
        changed = True
        while changed:
            changed = False
            ga = max(group, key=lambda g: g.length)
            ug = unit(ga)
            for j, b in enumerate(walls):
                if used[j]:
                    continue
                ub = unit(b)
                cosv = abs(float(np.dot(ug, ub)))
                if cosv < np.cos(ang_thr):
                    continue
                mid = np.array([(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2])
                delta = mid - np.array([ga.x1, ga.y1])
                # 2D 叉积绝对值 = 横向距离
                lateral = abs(float(ug[0] * delta[1] - ug[1] * delta[0]))
                if lateral > dist_mm * 0.55:
                    continue
                if not _segments_chainable(group, b, dist_mm):
                    continue
                group.append(b)
                used[j] = True
                changed = True
        out.append(_merge_group(group))
    return out


def mark_suspicious(walls: list[WallSeg], short_mm: float) -> list[int]:
    return [i for i, w in enumerate(walls) if w.length < short_mm]


# ── internals ──────────────────────────────────────────────


@dataclass
class _PxSeg:
    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def length(self) -> float:
        return float(np.hypot(self.x2 - self.x1, self.y2 - self.y1))


def _estimate_thickness_px(mask: np.ndarray) -> float:
    # 距离变换：墙内部最大半径 * 2
    inv = (mask > 0).astype(np.uint8)
    if inv.sum() < 10:
        return 4.0
    dist = cv2.distanceTransform(inv, cv2.DIST_L2, 3)
    vals = dist[inv > 0]
    if vals.size == 0:
        return 4.0
    r = float(np.percentile(vals, 75))
    return max(2.0, min(40.0, r * 2.2))


def _detect_lines_lsd(mask: np.ndarray) -> list[_PxSeg]:
    try:
        lsd = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)
        detected = lsd.detect(mask)
        lines = detected[0] if isinstance(detected, tuple) else detected
    except Exception:
        return []
    if lines is None:
        return []
    out: list[_PxSeg] = []
    arr = np.asarray(lines)
    # 兼容 (N,1,4) / (N,4) / list
    if arr.ndim == 3:
        arr = arr.reshape(-1, arr.shape[-1])
    elif arr.ndim == 1:
        return out
    for ln in arr:
        vals = np.asarray(ln).reshape(-1)
        if vals.size < 4:
            continue
        x1, y1, x2, y2 = float(vals[0]), float(vals[1]), float(vals[2]), float(vals[3])
        out.append(_PxSeg(x1, y1, x2, y2))
    return out


def _detect_lines_hough(mask: np.ndarray) -> list[_PxSeg]:
    edges = cv2.Canny(mask, 50, 150)
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180, threshold=40, minLineLength=20, maxLineGap=12
    )
    if lines is None:
        return []
    return [
        _PxSeg(float(a[0][0]), float(a[0][1]), float(a[0][2]), float(a[0][3]))
        for a in lines
    ]


def _segments_chainable(group: list[WallSeg], b: WallSeg, dist_mm: float) -> bool:
    ends: list[np.ndarray] = []
    for g in group:
        ends.append(np.array([g.x1, g.y1]))
        ends.append(np.array([g.x2, g.y2]))
    b_ends = [np.array([b.x1, b.y1]), np.array([b.x2, b.y2])]
    for e in ends:
        for be in b_ends:
            if np.linalg.norm(e - be) <= dist_mm:
                return True
    # 投影重叠：中点落在任一段延长邻域
    for g in group:
        if _point_near_segment(b.x1, b.y1, g, dist_mm) or _point_near_segment(
            b.x2, b.y2, g, dist_mm
        ):
            return True
    return False


def _point_near_segment(px: float, py: float, w: WallSeg, dist_mm: float) -> bool:
    ax, ay, bx, by = w.x1, w.y1, w.x2, w.y2
    abx, aby = bx - ax, by - ay
    t = ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby + 1e-9)
    t = max(0.0, min(1.0, t))
    cx, cy = ax + t * abx, ay + t * aby
    return np.hypot(px - cx, py - cy) <= dist_mm


def _merge_group(group: list[WallSeg]) -> WallSeg:
    pts = []
    for w in group:
        pts.append([w.x1, w.y1])
        pts.append([w.x2, w.y2])
    arr = np.array(pts, dtype=np.float64)
    # PCA 主轴两端
    mean = arr.mean(axis=0)
    centered = arr - mean
    if len(arr) >= 2:
        cov = np.cov(centered.T)
        if cov.shape == (2, 2):
            eigvals, eigvecs = np.linalg.eigh(cov)
            axis = eigvecs[:, int(np.argmax(eigvals))]
        else:
            axis = np.array([1.0, 0.0])
    else:
        axis = np.array([1.0, 0.0])
    proj = centered @ axis
    i_min, i_max = int(np.argmin(proj)), int(np.argmax(proj))
    p0, p1 = arr[i_min], arr[i_max]
    thick = float(np.median([w.thickness for w in group]))
    return WallSeg(float(p0[0]), float(p0[1]), float(p1[0]), float(p1[1]), thick)
