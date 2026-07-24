# Space model · 墙体 2D/3D 编辑

## 参考
- [blueprint-js](https://github.com/aalavandhaann/blueprint-js)：`Corner` 共享角点 + `Wall` 两端附着；移角点联动所有附着墙；2D `WallView2D` / 3D `edge3d` 同源 model。
- [arcada](https://github.com/mehanix/arcada)：`WallNode` 拖拽改端点、`Wall` 拖身平移两端、长度 `Label`、链式 `AddWallManager`。

## 决策
- **不整库嵌入** blueprint-js / arcada（Three/Pixi 依赖重、与 RR7+Plane 壳冲突大）。
- 保留现有 `SpaceWall {x1,y1,x2,y2,thickness}` 线段模型；用 **共点联动**（端点坐标 ε=1mm）近似 corner graph。
- 2D 为精确编辑主战场；3D 等轴测同源展示 + 选中高亮，数值改长在右侧面板。

## 文件
| 文件 | 职责 |
|------|------|
| `space-wall-ops.ts` | 几何：端点移/吸附/正交、平移、定长、分割、命中 |
| `SpacePlanViewport.tsx` | 平面：选择/画墙、端点手柄、长度标注 |
| `SpaceWall3DViewport.tsx` | 等轴测挤出墙 + 选中 |
| `space-model-store.ts` | `setWalls` / `addWallSegment` / `updateWall` |
| `SpaceModelPage.tsx` | 编排 + 右侧拉长/厚/分割面板 |

## 交互
- 平面工具栏：**选择** | **画墙**（链式，Shift 正交，端点 120mm 吸附）
- 选中墙：拖端点拉长、拖墙身平移、共点墙联动
- 面板：长度 m 应用、±0.1m / +0.5m、单段墙厚、中点分割、删除
- Delete/Backspace 删选中墙；Esc 回选择工具
- 2D ↔ 3D 同一 `scene.walls`

## Deviations
- 未做真正 corner 拓扑与房间 polygon（blueprint Room）；后续若要门窗/房间面积再升级数据模型。
- 3D 未做端点拖拽（等轴测映射反算易抖）；改几何走平面或面板。
- 拖拽过程每帧写 localStorage（demo 可接受；量产应 debounce + 命令栈 undo）。

## 未知项
- 识墙结果端点未预合并时，联动依赖精确共点；可加「合并近端点」一键。
- 正式 three/glTF 编辑器是否直接 fork blueprint-js 的 model 层，待产品确认。
