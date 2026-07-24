# Formscape · Floorplan ML（CubiCasa5k 系）

独立识墙微服务：平面图 → 墙段 JSON，供 `formscape-app` 3D 模型 L2/L3 调用。

## 架构

```
上传图/PDF栅格
    → POST /v1/detect
        → backend=auto
            ├─ CubiCasa5k 权重就绪？ → hourglass heatmap → wall mask
            └─ 否则 heuristic（OpenCV 厚线）
        → 后处理：闭运算 · LSD 线段 · 角点吸附 · 共线合并 · 短段剔除
    → { walls[], width_mm, depth_mm, method }
```

| method | 含义 |
|--------|------|
| `ml-cubicasa` | 官方风格 CubiCasa 权重推理 |
| `ml-heuristic` | 无权重时的服务端 CV + 同一套后处理（可联调） |

前端契约对齐 `SpaceWall`（mm，左上原点）。

## 快速启动（无权重也可）

```bash
cd services/floorplan-ml
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload
```

```bash
curl -s http://127.0.0.1:8090/health | jq
curl -s -F "file=@plan.png" -F "strictness=50" -F "backend=auto" \
  http://127.0.0.1:8090/v1/detect | jq '.method,.wall_count,.message'
```

前端默认请求：`VITE_FLOORPLAN_ML_URL=http://127.0.0.1:8090`（见 web `.env`）。

## 启用真正的 CubiCasa5k

1. **权重**  
   官方/社区训练权重（常见名 `model_best_val_loss_var.pkl`）放到：

   ```
   services/floorplan-ml/weights/model_best_val_loss_var.pkl
   ```

   或：

   ```bash
   export CUBICASA_WEIGHTS=/abs/path/to/weights.pkl
   ```

2. **模型代码**（官方 hourglass）

   ```bash
   cd /path/to
   git clone --depth 1 https://github.com/CubiCasa/CubiCasa5k.git
   export PYTHONPATH="/path/to/CubiCasa5k:$PYTHONPATH"
   pip install torch torchvision  # 按机器选 CPU/CUDA wheel
   ```

3. **重启服务**，`GET /health` 应显示 `"cubicasa": true`。

4. 前端选 **ML 识墙** 或 `backend=cubicasa`。

> 注意：CubiCasa 训练集偏北欧家具平面图，中国施工图/扫描件建议后续用你们 20～50 张数据微调。

## API

### `GET /health`

```json
{
  "ok": true,
  "backends": { "heuristic": true, "cubicasa": false },
  "weights_path": null,
  "note": "..."
}
```

### `POST /v1/detect`（multipart）

| 字段 | 默认 | 说明 |
|------|------|------|
| `file` | 必填 | PNG/JPG |
| `strictness` | 50 | 0–100，映射后处理阈值 |
| `target_long_mm` | 12000 | 长边物理尺度 |
| `backend` | auto | auto \| cubicasa \| heuristic |
| `return_preview` | false | 返回叠加预览 base64 |

响应：

```json
{
  "ok": true,
  "walls": [{ "x1": 0, "y1": 0, "x2": 5000, "y2": 0, "thickness": 120 }],
  "width_mm": 12000,
  "depth_mm": 9000,
  "method": "ml-heuristic",
  "backend": "heuristic",
  "wall_count": 12,
  "message": "...",
  "meta": { "after_cleanup": 12, "dropped_short": 3 }
}
```

## Docker

```bash
docker build -t formscape-floorplan-ml .
docker run --rm -p 8090:8090 -v "$PWD/weights:/app/weights" formscape-floorplan-ml
```

## 与前端集成

- `space-ml-client.ts`：探测 health + detect
- `space-plan-pipeline.ts`：图片路径优先 ML，失败回退浏览器识墙
- L2 侧栏：ML 识墙开关

## 评测建议

准备 20 张真实图（PDF 矢量导出 / 扫描 / 带家具平面），记录：

- 墙段数 vs 人工
- 误检短段比例
- 端点误差（mm）

再决定是否微调 CubiCasa。
