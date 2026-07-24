"""
CubiCasa5k 系推理后端

官方仓库：https://github.com/CubiCasa/CubiCasa5k
论文模型：Hourglass + 多通道 heatmap（墙 / 房间 / 图标）

本模块：
- 若存在权重文件 + torch + floortrans，则加载官方风格 hourglass 推理
- 否则返回 unavailable，由上层回退 heuristic

权重放置（任选其一）：
  services/floorplan-ml/weights/model_best_val_loss_var.pkl
  环境变量 CUBICASA_WEIGHTS=/path/to/weights.pkl
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from app.postprocess import WallSeg, mask_to_walls

WEIGHT_CANDIDATES = [
    Path(__file__).resolve().parents[2] / "weights" / "model_best_val_loss_var.pkl",
    Path(__file__).resolve().parents[2] / "weights" / "cubicasa5k.pkl",
    Path(__file__).resolve().parents[2] / "weights" / "cubicasa.pth",
]

_MODEL = None
_DEVICE = "cpu"
_LOAD_ERROR: Optional[str] = None


def weights_path() -> Optional[Path]:
    env = os.environ.get("CUBICASA_WEIGHTS")
    if env and Path(env).is_file():
        return Path(env)
    for p in WEIGHT_CANDIDATES:
        if p.is_file():
            return p
    return None


def is_available() -> bool:
    if weights_path() is None:
        return False
    try:
        import torch  # noqa: F401

        return True
    except ImportError:
        return False


def load_status() -> dict:
    return {
        "available": is_available(),
        "weights": str(weights_path()) if weights_path() else None,
        "loaded": _MODEL is not None,
        "device": _DEVICE,
        "error": _LOAD_ERROR,
    }


def _try_load():
    global _MODEL, _DEVICE, _LOAD_ERROR
    if _MODEL is not None:
        return _MODEL
    if _LOAD_ERROR and _MODEL is None:
        # 允许重试：若仅上次失败可清环境后再调
        pass
    wp = weights_path()
    if not wp:
        _LOAD_ERROR = "no weights file"
        return None
    try:
        import torch

        _DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
        try:
            from floortrans.models import get_model  # type: ignore

            model = get_model("hg_furukawa_original", 51)
            ckpt = torch.load(str(wp), map_location=_DEVICE, weights_only=False)
            state = ckpt["model"] if isinstance(ckpt, dict) and "model" in ckpt else ckpt
            model.load_state_dict(state)
            model.to(_DEVICE)
            model.eval()
            _MODEL = model
            _LOAD_ERROR = None
            return _MODEL
        except Exception as e1:
            _LOAD_ERROR = (
                "CubiCasa 权重存在但模型结构未装入"
                "（需 PYTHONPATH 含 CubiCasa5k 的 floortrans，或导出 ONNX）。"
                f" detail={e1}"
            )
            return None
    except Exception as e:
        _LOAD_ERROR = str(e)
        return None


def predict_wall_mask(bgr: np.ndarray) -> Optional[np.ndarray]:
    """返回 HxW uint8 墙 mask；失败返回 None。"""
    global _LOAD_ERROR
    model = _try_load()
    if model is None:
        return None
    try:
        import torch

        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        h0, w0 = rgb.shape[:2]
        side = 512
        scale = side / max(h0, w0)
        nh, nw = int(round(h0 * scale)), int(round(w0 * scale))
        ph = (256 - nh % 256) % 256
        pw = (256 - nw % 256) % 256
        resized = cv2.resize(rgb, (nw, nh), interpolation=cv2.INTER_AREA)
        padded = cv2.copyMakeBorder(resized, 0, ph, 0, pw, cv2.BORDER_CONSTANT, value=255)
        ten = torch.from_numpy(padded.transpose(2, 0, 1)).float() / 255.0
        ten = ten.unsqueeze(0).to(_DEVICE)
        with torch.no_grad():
            out = model(ten)
        if isinstance(out, (tuple, list)):
            out = out[0]
        heat = out[0].detach().cpu().float()
        c = heat.shape[0]
        wall_idx = [0, 1] if c >= 2 else list(range(c))
        wall_h = heat[wall_idx].mean(0).numpy()
        wall_h = wall_h[:nh, :nw]
        wall_h = cv2.resize(wall_h, (w0, h0), interpolation=cv2.INTER_LINEAR)
        thr = float(np.percentile(wall_h, 85))
        return (wall_h >= thr).astype(np.uint8) * 255
    except Exception as e:
        _LOAD_ERROR = f"inference failed: {e}"
        return None


def detect_walls(
    bgr: np.ndarray,
    *,
    strictness: int = 50,
    target_long_mm: float = 12000.0,
) -> Optional[tuple[list[WallSeg], float, float, dict]]:
    mask = predict_wall_mask(bgr)
    if mask is None:
        return None
    h, w = bgr.shape[:2]
    if w >= h:
        width_mm = target_long_mm
        depth_mm = target_long_mm * (h / max(w, 1))
    else:
        depth_mm = target_long_mm
        width_mm = target_long_mm * (w / max(h, 1))

    t = strictness / 100.0
    walls, meta = mask_to_walls(
        mask,
        width_mm=width_mm,
        depth_mm=depth_mm,
        min_len_ratio=0.02 + t * 0.04,
        drop_short=True,
        short_ratio=0.03 + t * 0.03,
    )
    meta["strictness"] = strictness
    meta["cubicasa"] = load_status()
    return walls, width_mm, depth_mm, meta
