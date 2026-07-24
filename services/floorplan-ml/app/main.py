"""
Formscape · 平面识墙 ML 服务
POST /v1/detect  multipart image + strictness
GET  /health
"""
from __future__ import annotations

import base64
import io
from typing import Literal, Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from app.backends import cubicasa, heuristic
from app.schemas import DetectResponse, HealthResponse, WallSegment

app = FastAPI(
    title="Formscape Floorplan ML",
    description="CubiCasa5k 系平面识墙 + 几何后处理（角点吸附 / 共线合并）",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health():
    cc = cubicasa.load_status()
    return HealthResponse(
        ok=True,
        backends={
            "heuristic": True,
            "cubicasa": bool(cc.get("available")),
        },
        weights_path=cc.get("weights"),
        note=cc.get("error")
        or (
            "cubicasa ready"
            if cc.get("available")
            else "cubicasa 权重未就绪，auto 将用 heuristic（OpenCV 厚线+后处理）"
        ),
    )


@app.post("/v1/detect", response_model=DetectResponse)
async def detect(
    file: UploadFile = File(..., description="平面图 PNG/JPG"),
    strictness: int = Form(50),
    target_long_mm: float = Form(12000),
    backend: Literal["auto", "cubicasa", "heuristic"] = Form("auto"),
    postprocess: bool = Form(True),
    return_preview: bool = Form(False),
):
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "empty file")
    try:
        bgr = _decode_image(raw)
    except Exception as e:
        raise HTTPException(400, f"invalid image: {e}") from e

    strictness = max(0, min(100, int(strictness)))
    chosen = backend
    walls = None
    width_mm = depth_mm = 0.0
    meta: dict = {}
    method: Literal["ml-cubicasa", "ml-heuristic", "ml-unavailable"] = "ml-unavailable"
    message = ""

    # 1) CubiCasa
    if backend in ("auto", "cubicasa"):
        if cubicasa.is_available() or backend == "cubicasa":
            result = cubicasa.detect_walls(
                bgr, strictness=strictness, target_long_mm=target_long_mm
            )
            if result is not None:
                walls, width_mm, depth_mm, meta = result
                method = "ml-cubicasa"
                chosen = "cubicasa"
                message = f"CubiCasa 识墙 → {len(walls)} 段（严格度 {strictness}）"
            elif backend == "cubicasa":
                st = cubicasa.load_status()
                raise HTTPException(
                    503,
                    detail={
                        "error": "cubicasa unavailable",
                        "status": st,
                        "hint": "放置权重到 weights/ 并 pip install torch；PYTHONPATH 含 floortrans",
                    },
                )

    # 2) heuristic fallback
    if walls is None:
        walls, width_mm, depth_mm, meta = heuristic.detect_walls(
            bgr, strictness=strictness, target_long_mm=target_long_mm
        )
        method = "ml-heuristic"
        chosen = "heuristic"
        message = (
            f"ML-heuristic 识墙 → {len(walls)} 段（严格度 {strictness}；"
            f"CubiCasa 未启用时的服务端后处理版）"
        )
        if backend == "auto":
            message += " · 提示：配置 CubiCasa 权重后可自动切换"

    if not postprocess:
        # postprocess 已在 mask_to_walls 内；此处保留开关兼容
        meta["postprocess_note"] = "cleanup always applied in mask_to_walls"

    preview_b64: Optional[str] = None
    if return_preview:
        preview_b64 = _overlay_preview(bgr, walls, width_mm, depth_mm)

    return DetectResponse(
        ok=True,
        walls=[WallSegment(**w.as_dict()) for w in walls],
        width_mm=width_mm,
        depth_mm=depth_mm,
        method=method,
        message=message,
        backend=chosen,
        wall_count=len(walls),
        meta=meta,
        preview_png_base64=preview_b64,
    )


def _decode_image(raw: bytes) -> np.ndarray:
    arr = np.frombuffer(raw, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        # PIL fallback (webp etc.)
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        rgb = np.array(im)
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    # 限制边长，防 OOM
    h, w = bgr.shape[:2]
    max_side = 1600
    m = max(h, w)
    if m > max_side:
        s = max_side / m
        bgr = cv2.resize(bgr, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    return bgr


def _overlay_preview(
    bgr: np.ndarray, walls: list, width_mm: float, depth_mm: float
) -> str:
    h, w = bgr.shape[:2]
    vis = bgr.copy()
    sx = w / max(width_mm, 1)
    sy = h / max(depth_mm, 1)
    for wall in walls:
        p1 = (int(wall.x1 * sx), int(wall.y1 * sy))
        p2 = (int(wall.x2 * sx), int(wall.y2 * sy))
        cv2.line(vis, p1, p2, (80, 80, 220), 2)
    ok, buf = cv2.imencode(".png", vis)
    if not ok:
        return None  # type: ignore
    return base64.b64encode(buf.tobytes()).decode("ascii")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8090, reload=True)
