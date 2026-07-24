# CubiCasa5k 系平面识墙 · 构境落地说明

日期：2026-07-24  
状态：服务骨架已接入（`services/floorplan-ml` + 前端 pipeline）

## 目标

把「浏览器启发式识墙」升级为 **语义分割 → 矢量化 → 几何清理**，降低家具线/标注误检，与已有 2D 墙体编辑闭环配合。

## 参考

- 数据集/模型：https://github.com/CubiCasa/CubiCasa5k  
- 任务：平面图 → 墙/房间/门窗 heatmap  
- 本仓服务：`services/floorplan-ml/`

## 调用链

```
L2 上传图片
  → prefer ML?
       → GET /health
       → POST /v1/detect  → method: ml-cubicasa | ml-heuristic
  → 失败则 space-image-walls（浏览器）
PDF 矢量够用 → 仍走 pdf-vector（不强制 ML）
PDF 栅格回退 → 同图片，可走 ML
```

## 后端

| 路径 | 说明 |
|------|------|
| `app/main.py` | FastAPI `/health` `/v1/detect` |
| `app/backends/cubicasa.py` | 权重 + floortrans hourglass（可选） |
| `app/backends/heuristic.py` | OpenCV 厚线（无权重可联调） |
| `app/postprocess.py` | mask→LSD→角点吸附→共线合并→短段剔除 |

## 启用 CubiCasa 真权重

1. 下载官方/社区 `model_best_val_loss_var.pkl` → `weights/`  
2. `git clone CubiCasa5k`，`export PYTHONPATH=...`  
3. `pip install torch`  
4. 重启 uvicorn，确认 `/health.backends.cubicasa == true`

## 前端

- `space-ml-client.ts`：URL / prefer 开关  
- `space-plan-pipeline.ts`：图片/PDF 栅格优先 ML  
- L2 侧栏：ML 开关 + 健康状态  
- `SpaceDetectMethod`：`ml-cubicasa` | `ml-heuristic`

环境变量：`VITE_FLOORPLAN_ML_URL=http://127.0.0.1:8090`

## 后续

1. 20～50 张真实平面评测表  
2. 中国施工图微调 / ONNX 导出减负  
3. SAM 半自动兜底难例  
