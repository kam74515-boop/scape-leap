"""与前端 SpaceWall / PlanImportResult 对齐的 JSON 契约。"""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class WallSegment(BaseModel):
    """毫米坐标系，原点左上，x 向右 y 向下（与 formscape 2D 视口一致）。"""

    x1: float
    y1: float
    x2: float
    y2: float
    thickness: float = 120


class DetectRequestMeta(BaseModel):
    """multipart 之外的可选 JSON 字段也可走 query。"""

    strictness: int = Field(50, ge=0, le=100)
    target_long_mm: float = Field(12000, gt=0)
    backend: Literal["auto", "cubicasa", "heuristic"] = "auto"
    postprocess: bool = True


class DetectResponse(BaseModel):
    ok: bool = True
    walls: list[WallSegment]
    width_mm: float
    depth_mm: float
    method: Literal["ml-cubicasa", "ml-heuristic", "ml-unavailable"]
    message: str
    backend: str
    wall_count: int = 0
    meta: dict[str, Any] = Field(default_factory=dict)
    preview_png_base64: Optional[str] = None  # 可选 debug 热力图


class HealthResponse(BaseModel):
    ok: bool
    service: str = "floorplan-ml"
    backends: dict[str, bool]
    weights_path: Optional[str] = None
    note: str = ""
