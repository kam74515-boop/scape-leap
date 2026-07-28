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

---

## 2026-07-27 设计规范 v3 收尾（年轻化扁平化 100% 合规）

依据 `research/构境AI-设计规范-v3-年轻化扁平化.md` 全量审计后的收尾批次，共 7 项：

| 项 | 文件 | 改动 |
|---|---|---|
| frame tint 误用 AI 紫 | `canvas/CanvasWorkspace.tsx` ×2 | `rgba(139,92,246,0.04)` → `rgba(99,102,241,0.04)`（brand 靛蓝同透明度；仅影响新建 frame，存量文档数据不动） |
| 悬浮层阴影不统一 | `context-menu.tsx` / `settings-modal.tsx` / `mask-edit-overlay.tsx` | `shadow-lg/xl` → `shadow-overlay-200`；settings-modal 顺带 `rounded-lg`→`rounded-xl`（弹窗规范 16px） |
| 检测进度条色 | `SpaceModelPage.tsx` | `FsProgress ai={false}` → `ai`（规范 §5 明确「生成/检测进行中用 ai 紫」，识墙属 AI 能力，无真正冲突） |
| 收藏星硬编码金 | `canvas/panels/skills-library-grid.tsx` | `#EBB95E` → `fill-warning-secondary text-icon-warning-secondary`（随主题） |
| 徽标技术词 | `SpaceModelPage.tsx` + `l2-sidebars.tsx` + `space-plan-pipeline.ts` | 「识别服务在线→增强识别已开启」「权重→模型」「识别服务未启动→增强识别未开启」；L2 状态行与 pipeline 错误串同步收口；ARCHITECT_ENABLED 说明保留在启动指引弹窗内 |
| 2D 编辑视口硬编码色 ×13 | `SpacePlanViewport.tsx` | 全部迁 `--fs-plan-*` / `--neutral-*` / `--border-success-strong` |
| 3D 等轴测视口硬编码色 ×12 | `SpaceWall3DViewport.tsx` | 同上；三面明暗梯度映射 accent/neutral 阶梯，dark 下梯度保持 |

### 决策
- **新增 3 个 token**：`--fs-plan-accent-subtle/soft/strong`（= brand-200/500/900），定义于 variables.css light 段；因引用 brand 阶，dark 自动适配无需覆盖。
- **两个孤儿视口不删除只迁 token**：`SpacePlanViewport` / `SpaceWall3DViewport` 当前无页面引用，但差距清单 P0「识别→手工修正闭环」要重建轻量编辑，这两个文件是现成基础；迁 token 后 dark 不再破图。
- **`SpacePlanViewport.tsx` 保留 1 处 `#0f172a`**：图块标签文字印在 `pl.color` 数据色块上，色块本身不随主题变（与技能卡渐变封面同一豁免逻辑），文字必须保持固定深色，已加注释。
- frame tint 改的是**新建默认值**；`tint` 会序列化进画布文档，存量文档里的旧紫色 tint 不迁移（数据兼容）。

### 验证
- `pnpm check:types` 通过（react-router typegen + tsc --noEmit）。
- 复审 grep：formscape 全目录无 `window.alert/confirm/prompt`、无 `text-[9px]`、无 `shadow-lg/xl/2xl`（悬浮层）、无 `#EBB95E` 类硬编码（除豁免的数据色板/渐变封面与上述 1 处图块文字）。

### 未知项
- dark 主题下 3D 等轴测视口的 neutral 阶梯观感（顶面最亮）未上机目验，建议下次起 dev server 双主题过一遍。
- `SpaceModelPage` 检测进度改 ai 紫后，与页面其他 brand 元素的并置效果未目验。

---

## 2026-07-27(2) 止血/真源/补残/闭环（开发计划阶段 1-5）

### 决策
- **统一 Project 数据模型 = `studio-model.ts`**：项目目录(pm-mock) × 进度(project-progress-store) × 任务(tasks-store) 三源汇合；仪表盘 KPI 与项目卡全部改从 `getStudioKpi()` / `getProjectCardModel()` 派生。风险规则：有逾期任务→延期、有 stale 阶段→关注、否则正常（替代 pm-mock 静态 risk 字段，DASHBOARD_KPI 已删）。
- **画布持久化纯函数化**：`persistCanvasDoc`/`loadCanvasDoc`/`cleanupLegacyDocKeys` 导出为模块级纯函数，hook 的 persist 委托之——保证 node 环境可直测 shipped 路径（无 DOM 依赖）。
- **测试基座 = vitest 4**（apps/web，node env + setup.ts localStorage polyfill）；`pnpm test` 跑 3 文件 20 项。
- **识别→手工修正闭环的落点是 F23dPlanViewer 修正模式**（点选删误检墙/门/窗、拖端点、改墙厚），不是 SpacePlanViewport；后者保留作未来轻量编辑器基础（已 token 化）。
- **downloadPlanExport 删除**：导出唯一路径 = buildWallsObj → downloadTextFile（OBJ，有测试）。

### Deviations
- 差距清单（2026-07-26）多处「当前实现状态」已过时：画布双写、L2 假导航、CRUD、v3 逐页换装、墙编辑闭环在工作树中已被前序会话完成大部；本轮 = 审计验证 + 补测试 + 收尾（命名/死代码/真源/文档），未重写已有实现。已在差距清单条目上以「✅2026-07-27」标注，并新增 `research/构境AI-开发计划-2026-07-27.md` 作当前唯一阶段×状态真源。
- 仪表盘项目卡移除静态 `updatedAt` 展示（假数字段，无真源）。

### 验证
- `pnpm test` 20/20 绿；`check:types` 0 error；`build` exit 0；dev 两次独立启动均 HTTP 200 + 含「构境」；证据在 goal scratch（build/ui-audit/store-tests/p0-tests/launch-1/launch-2.log + home/canvas.png）。

### 未知项
- studio-model 的风险派生规则（逾期→延期）是本轮新立的产品规则，阈值（如逾期几天算延期）未来可能需要用户调。

---

## 2026-07-27(3) 去 Plane 影子（空态/图标全量替换）

### 决策
- **propel 空态注册表全局接管**：`getDetailedAsset`/`getCompactAsset` 不再返回 Plane 插画，统一输出 `formscape-line-art.tsx` 构境线条插画（5 语义变体：通用/看板/盾牌/搜索/收件箱，currentColor 随主题）；原 Plane 注册表保留仅供 storybook。一次改动覆盖所有用 EmptyStateDetailed/Compact 的页面（含 Plane 残留页）。
- **app/assets 文件级替换 51 个 SVG**：empty-state/** 50 个 + emoji/project-emoji.svg + auth/未授权系列 + instance/maintenance-* + scribble/* + 404.svg，同名同路径换构境线条插画（#8A8F99 中性描边，img 标签场景双主题可读），导入方零改动。webp 位图（draft/stickies/analytics 等深层残留页）未换——类型不符且页面属待收编残留。
- **页面级重写**：根 404（not-found.tsx → FsEmpty 中文）、生产错误页（error/prod.tsx → 内联构境盾牌插画 + 中文）、项目守卫（project-guard.tsx 取代 Plane ProjectAuthWrapper）。
- **品牌徽标**：edition-badge「Community + Plane 付费升级弹窗」→「构境AI · 演示版」静态徽标。
- OAuth 第三方 logo（google/github/gitlab/gitea）与构境品牌资源（mark/logo-cn/logo-en）不属 Plane 影子，保留。

### Deviations
- 深层 Plane 残留页（analytics/cycles/modules/views/pages/intake/archives）的页面骨架仍是 Plane UI（空态插画已换构境）；按差距清单 P2「隐藏或收编」后置。

### 验证
- playwright：12 条项目路由全通（Plane404 零残留）；根 404 构境空态；团队管理/users+team 双路径；check:types 0 error；测试 20/20。

---

## 2026-07-28 SQLite 数据层 + 零 emoji

### 架构
- **真源**：`formscape-app/data/formscape.db`（SQLite 3，gitignored）→ `scripts/fs-db.mjs`（node:sqlite 仓储层，零原生依赖）→ `scripts/fs-routes.mjs`（/api/fs/* REST）→ `scripts/mock-api.mjs` 挂载 → vite 代理 → `fs-data-client.ts`（内存缓存 + 乐观写 + change 事件）→ 各 *-store（同步 API 不变，UI 零改动）。
- **实体 21 个**：tasks/drafts/drafts_hidden/customers/members/purchase_lines/style_boards/style_stage/render_stage/progress/space_scene/space_uploads/canvas_docs/ai_sessions/ai_inbox/files/files_hidden/construction/extra_projects/portal_state/demo_project。
- **种子**：`scripts/fs-seed.mjs` 首次建库播种（从 TS mock 迁移并 emoji-free）；`/api/fs/_reseed` 可重播（测试/开发）。
- **seed-on-miss 守卫**：`isFsHydrated(entity)` 未完成前，progress/style_stage/style_boards/space_scene 只在内存给种子、不写服务端（防 SSR/首屏覆盖已持久化数据）。

### 决策
- **选 node:sqlite 而非 better-sqlite3**：Node 25 内置、零编译依赖；代价是 ExperimentalWarning。
- **静态目录不入库**：PM_PROJECTS/ECO_PRODUCTS/SPACE_BLOCKS/STAGES 等不可变 fixture 保留前端常量（非用户数据）。
- **localStorage 仅留 UI 偏好**：space-detect strictness、tree-nav 展开、ml-prefer/url、canvas settings（验收豁免）。
- **emoji 清零**：PmProject.emoji/ProjectCanvasTree.emoji 字段删除，仪表盘项目卡改 identifier 首字 chip（brand 软色块）；✓→√(U+221A)、✗→×、权限表→「可」、✦ 注释改文字；`__tests__/emoji-free.test.ts` 为常设回归闸门。
- **顺带修复 Plane fork 预存 hydration mismatch**：root.tsx HydrateFallback 与 LogoSpinner 不再依赖 resolvedTheme（服务端恒 undefined 导致首帧不一致）——页面验证「零 page error」达标前提。

### Deviations
- 画布文档实体 id 形态从 `formscape.canvas.doc.v2::{p}::{b}` 简化为 `{p}::{b}`（SQLite 主键）；CANVAS_STORAGE_KEY 常量不再被消费。
- 空间场景持久化只存瘦身副本（去大 base64），完整图仅在会话内存（原 localStorage 时代策略延续）。

### 验证
- 重启持久化两轮：写 → 杀进程 → 重启 → 读回（persistence.log）；DB 为真实 SQLite 3 文件（file 输出在 evidence.log）。
- 全栈 playwright：任务/客户/画布/采购页非空 + API 新建任务刷新仍在 + 零 page error（pages.log，ALL-PASS）。
- `pnpm check:types` 0 错误；`pnpm test` 23/23（含 fs-db 仓储直测与 emoji 闸门）；emoji grep 0 匹配（emoji-grep.log）。

### 2026-07-28 补丁（审查后）
- 补迁 `gen_history`（AI 生成历史，图库「历史」数据源）与 `canvas_boards`（自建子画布树条目，原 fs-canvas-tree-extra）两个漏网实体；L2 画布树订阅 CANVAS_TREE_CHANGE_EVENT 在 hydrate 后刷新。技能收藏 FAV_KEY 归类 UI 偏好保留 localStorage。实体总数 23。

---

## 2026-07-28(2) 无限画布 UI 统一（规范 v3 画布域收口）

### 改动
- **背景板感化**：`Background` 由 `bg-surface-1` 改 `bg-canvas`——画布与白色面板分层，「无限板」观感；点阵仍走 `var(--border-subtle)`。
- **选中环统一**：图片节点从 1px `outline-accent-primary`（近黑细线观感）改为与其他节点同一 brand 环语言——1px brand 实线 + 35% 柔光晕（直角保持，红线不破）。
- **frame tint 双保险**：frame-node 渲染时把历史 `rgba(139,92,246,*)` 紫 tint 归一为 brand（`normalizeFrameTint`），缺省值同 brand；数据库 4 份 canvas_docs 扫描无需迁移（已是 brand）。
- **frame 边框减重**：2px dashed → 1px dashed，容器更轻盈。
- **pastel 色板提亮一档**（规范 §1）：STICKY_COLORS / SHAPE_FILLS 全部 100 阶 → 50 阶（FFFBEB/EFF6FF/FDF2F8/ECFDF5/F5F3FF/FFF7ED，形状首色 brand 同族 indigo-50）。
- **浮层圆角/阴影统一**：minimap 6px → 12px + `shadow-overlay-100`；左下缩放控件 6px → pill + `shadow-overlay-100`（与主坞同一语言）；L2 搜索框 6px → 8px（对齐全局 fsInputClass）。
- dark 主题实测：背景/frame tint/选中环/技能轨（AI 紫 CTA、brand 滑杆）均正确随 token 切换。

### 验证
- playwright 双主题截图：idle / 选中 / 技能库 / 技能参数轨（light+dark）；`check:types` 0 错误；测试 25/25。
