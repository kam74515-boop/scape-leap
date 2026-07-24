# 构境AI · 基于 Plane 的前端大重构说明

> 日期：2026-07-23  
> 上游参考：https://github.com/makeplane/plane（本地 `refs/plane/` sparse clone）  
> **后端 API 零改动**

---

## 1. 从 Plane 抽了什么

| 源码位置 | 模式 | 构境落地 |
|---|---|---|
| `apps/web/.../(projects)/layout.tsx` | Sidebar + ExtendedSidebar + `main > Outlet` | `App`：`Sidebar` + `main` |
| `workspace/sidebar/projects-list-item.tsx` | 项目行可展开 Disclosure | 侧栏 Projects 下 `▾` 展开 |
| `workspace/sidebar/project-navigation.tsx` | Issues / Cycles / Pages… | Overview / 需求 / 风格 / 画布 / … |
| `sidebar/sidebar-wrapper.tsx` | 顶栏标题 + 滚动区 + 底栏 | Workspace 徽章 + 滚动列表 + Settings/用户 |

**刻意没抄：** Plane 的路由/React Router、MobX、SWR、权限系统、AGPL 业务代码（仅学 IA 与布局，自写实现）。

---

## 2. 交互（目标态）

```
侧栏固定
  Home → 主区 Projects 表
  点表行 / 点侧栏项目 → 该项目在侧栏展开子导航 + 主区 Overview
  点子导航 → 只换主区
  再点项目头 → 收起并回 Home
```

客户：**不是**侧栏一级，而是项目 `profile.clientName|Phone|Note`。

---

## 3. 改动文件清单（前端）

- `src/App.tsx` — 壳
- `src/components/Sidebar.tsx` — Plane 侧栏
- `src/components/Dashboard.tsx` — Projects 表
- `src/components/Workspace.tsx` — 项目主区
- `src/styles.css` — `pl-*` Plane 感样式 + 圆角壳
- 文档：`构境AI-现状页面导图.md`（本目录）

未改：`server/**`、API 契约、`api.ts` 路径。

---

## 4. 视觉令牌（原生 Plane）

文件：`formscape-demo/src/plane-tokens.css`  
摘自 `refs/plane/packages/tailwind-config/variables.css`：

| 语义 | Plane | 构境映射 |
|---|---|---|
| 画布底 | `--bg-canvas` / neutral-300 | `--bg-subtle`（外层壳） |
| 表面 | `--bg-surface-1` 白 | `--bg` / 侧栏+主区卡片 |
| Hover / Active | `layer-transparent` 5% / 10% 黑 | `--bg-hover` / `--bg-active` |
| 主色 | `--brand-default` ≈ #3F76FF | `--btn-bg` / `--ai` / `--accent` |
| 主按钮 hover | `--brand-900` | `--btn-bg-hover` |
| 正文 | `--txt-primary` / text-13 | `--text` · body `13px` |
| 边框 | `--border-subtle` | `--border` |
| 圆角 | buttons `rounded-sm` 4px · nav `rounded-md` 6px | `--radius` / `--radius-md` |
| 字体 | Inter | `--sans` + Google Fonts |

深色模式：`[data-theme="dark"]` 使用 Plane dark 变体 oklch 值。

### 4.1 壳层观感（对齐 Plane content-wrapper）

- 外层 `bg-canvas` 灰底 + `8px` 内边距
- 侧栏 + 主区合成一张 `surface-1` 白卡片（左圆角侧栏 / 右圆角主区）
- 导航 active = 透明层 active（10% 黑），非品牌色块
- 主按钮 = brand 实心 + white on-color，hover 用 brand-900（不用 filter）

## 5. 后端变更（2026-07-23，已放开「后端不改」约束）

| API | 说明 |
|---|---|
| `GET /api/workspace` | 工作室、席位、成员 |
| `GET/POST /api/projects/{id}/work-items` | Plane 风格看板 work items |
| `PUT/DELETE /api/projects/{id}/work-items/{wid}` | 更新状态/字段、删除 |
| Project `icon` / `identifier` | 侧栏标识与 key 前缀（如 BJ-7） |

模型：`WorkItem`（state: backlog \| todo \| in_progress \| done，priority、stage、assignee、dueDate）。  
设计阶段 / 画布 / 渲染等旧 API 保留。

## 6. 前端壳（对齐 GitHub Plane，禁止自研浮卡）

```
bg-canvas
┌──────┬──────────────┬─────────────────────────┐
│ Rail │ Sidebar      │ Main surface-1          │
│ 52px │ 250px        │ breadcrumb 40px         │
│ 图标 │ Projects     │ Work items 看板         │
│      │ 项目展开子导航│ / 阶段页 / 画布 L1       │
└──────┴──────────────┴─────────────────────────┘
贴边 · 无 margin 圆角浮卡 · active = layer 透明灰
```

- 打开项目默认 **Work items**
- 子导航：构境阶段（无项目内「画布」项；画布在 Rail L1）
- 类名 `pn-*` 仅作映射，视觉按 Plane token / 截图密度

## 7. 许可注意

Plane 为 **AGPL-3.0**。我们**未复制**组件源码，仅参考 IA 并摘录**设计令牌数值**自行映射。`refs/plane` 仅本地对照，勿并入发行包。
