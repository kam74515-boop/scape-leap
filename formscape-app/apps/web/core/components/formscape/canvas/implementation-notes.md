# 画布产品线 — 实现笔记

## 北极星（本轮启动）
向 Lovart 级 AIGC 画布推进。**本轮不做全局 Agent**，优先：
1. 一键式技能落图
2. 交互式图像修改
3. 画布版 Agent

## 已交付（2026-07 · 交互逻辑全自动推进）

### 1. 一键式技能落图 ✅
- 技能轨 → **一键生成落图**
- `autoPromoteOnDone` + `removeAfterPromote`：生成完直接变成图片节点（叠在原位）
- Toast：生成中 / 已落图
- 多结果 count 一次落齐

### 2. 交互式图像修改 ✅
- 选中顶栏：**再生成 · 延展 · 变体 · AI**
- 双击图片/生成器 → 风格延展
- 均自动跑 Demo 生成并落图

### 3. 画布 Agent ✅（非全局）
- 意图解析：`生成：` / `改图：` / `变体` / `画布上有什么`
- Tools：snapshot / place_gen / edit_selected / place_image
- 画布页默认 canvas skill；经营/采购仍可触发

## 模拟数据（2026-07-24）
- **技能库 = 精确 14 个**，id 对齐 `lovspark-skill-library-cases` 目录名  
  unfurnished-space-generation / white-model-rendering / architectural-multi-angle /  
  space-to-axonometric / space-atmosphere-transformation / seasonal-changes /  
  old-house-renovation / multi-shot-storyboard / furniture-sketches / color-mood-analysis /  
  material-extraction-analysis / material-replacement / product-inspiration-expansion / model-generation  
- 生成结果：`gen-demo` + `mock-skill-assets`，全部返回 case 真实图 `src`（非色板）  
- 静态路径：`public/mock-skills` → symlink 到 cases 根目录  
- 技能轨：**填入示例** 用 case 输入图填槽，便于无上传体验  
- 白模：仅白模图 + 参考图，**无材质槽**  
- 已移除视频技能与旧版虚构技能 id  

## 明确不做（本阶段）
| 能力 | 状态 |
|------|------|
| 正式生图 API | ❌ 全部 mock 图 |
| 全局 Agent | ❌ |
| 协作/版本 | ❌ |

## 持续开发（全自动收口 · 2026-07-24）

### 产品名与可移植 Mock
- 产品：**构境 AI / Formscape**  
- 静态样例包：`public/formscape-skill-mocks`（~8MB JPEG，可随仓提交）  
- **已移除** 对本机 `lovspark-skill-library-cases` symlink 依赖  

### 图库
- 样例 / 历史 / 上传 / 生成筛选  
- 样例 & 历史：**点击或拖拽**到画布（`CANVAS_DND_MIME`）  
- 生成落图写入 localStorage 历史  

### 交互
- 多结果 **水平并排** 落图；顶栏「并排」重排对比  
- 空白画布：**一键导入 4 张样例**  
- 右键：再生成/延展/变体/局部改图 + **完整 14 技能**  
- 选中顶栏：多角度 / 氛围 / 材质 / 白模 / **局部**  
- **局部改图蒙版壳**：涂选区 → mask + 源图 refs → mock 落图  
- 技能轨打开：**自动填入 case 示例图**  

### Agent
- 技能名 / 关键词路由 → skillId mock 图  

## 验收（全自动 Demo）
1. 空白画布 →「一键导入 4 张样例」（图来自 `/formscape-skill-mocks`）  
2. 选中 → 顶栏「局部」→ 涂选区 → 生成选区 → mock 落图  
3. 技能库任选 → 一键生成落图  
4. 图库样例拖到画布；历史可回读  
5. AI：`生成：空房设计` / `材质替换`  




