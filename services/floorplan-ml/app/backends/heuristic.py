"""
无权重回退：OpenCV 厚线扫描（对齐前端 space-image-walls 思路）
保证服务在没有 CubiCasa 权重时也能端到端联调。
"""
from __future__ import annotations

import numpy as np
import cv2

from app.postprocess import WallSeg, mask_to_walls


def image_to_wall_mask(bgr: np.ndarray, strictness: int = 50) -> np.ndarray:
    """BGR → 墙二值 mask。"""
    t = max(0, min(100, strictness)) / 100.0
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    # 轻度去噪
    gray = cv2.bilateralFilter(gray, 5, 40, 40)
    mean = float(gray.mean())
    # 墨线在亮底上
    thr = int(np.clip(mean - (16 + t * 32), 20, 200))
    _, ink = cv2.threshold(gray, thr, 255, cv2.THRESH_BINARY_INV)
    # 若墨太少，尝试 Otsu
    ratio = float((ink > 0).mean())
    if ratio < 0.004 or ratio > 0.55:
        _, ink = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        ratio = float((ink > 0).mean())
    # 形态学：去点噪，连墙
    k = max(2, int(3 + t * 2))
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k, k))
    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, kernel, iterations=1)
    ink = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, kernel, iterations=2)

    # 厚线优先：距离变换保留较厚结构
    dist = cv2.distanceTransform((ink > 0).astype(np.uint8), cv2.DIST_L2, 3)
    min_r = 0.8 + t * 1.2
    thick = ((dist >= min_r) & (ink > 0)).astype(np.uint8) * 255
    if (thick > 0).mean() < 0.002:
        thick = ink
    return thick


def detect_walls(
    bgr: np.ndarray,
    *,
    strictness: int = 50,
    target_long_mm: float = 12000.0,
) -> tuple[list[WallSeg], float, float, dict]:
    h, w = bgr.shape[:2]
    # 长边映射到 target_long_mm
    if w >= h:
        width_mm = target_long_mm
        depth_mm = target_long_mm * (h / max(w, 1))
    else:
        depth_mm = target_long_mm
        width_mm = target_long_mm * (w / max(h, 1))

    mask = image_to_wall_mask(bgr, strictness)
    t = strictness / 100.0
    walls, meta = mask_to_walls(
        mask,
        width_mm=width_mm,
        depth_mm=depth_mm,
        min_len_ratio=0.025 + t * 0.05,
        drop_short=True,
        short_ratio=0.035 + t * 0.03,
    )
    meta["strictness"] = strictness
    meta["ink_ratio"] = float((mask > 0).mean())
    return walls, width_mm, depth_mm, meta
