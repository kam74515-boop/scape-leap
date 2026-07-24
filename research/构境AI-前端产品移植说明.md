# 构境产品 → Plane UI 移植说明（前端-only）

> 2026-07-23 · 决策：只保留前端继续开发；只改 UI 层把产品迁到 Plane 壳。

## 目标

| 要 | 不要 |
|----|------|
| `plane-app/apps/web` 日常改 UI | Docker / Django 全栈日常依赖 |
| Plane 原生视觉与交互 | formscape-demo 自研 `pn-*` 壳 |
| 构境业务页叠在 extended 路由 | 再发明一套 App 壳 |
| mock-api + localStorage 数据 | 等后端才能点 UI |

## 已移植

| 产品 | 路由 | 代码 |
|------|------|------|
| 工作区默认 | `/scapeleap`（`/` 自动跳转） | authentication-wrapper |
| L1 画布 | `/:ws/canvas` | formscape/CanvasPage |
| 项目概览 | `.../overview` | formscape/OverviewPage |
| 七阶段 | `.../stages/:stageId` | formscape/StagesPage |
| Work items | Plane 原生 | 保留 |

## 导航改动

- App Rail：项目 + **画布**
- 项目侧栏/Tab：**概览 · 设计流程 · Work items**（Cycles/Modules 等默认关）

## 开发

```bash
cd plane-app && nvm use 22 && pnpm dev:local
```

详见 `plane-app/README-构境.md`。

## 画布（已接入 2026-07-23）

- 引擎：`@xyflow/react`
- 代码：`apps/web/core/components/formscape/canvas/`
- 功能壳对齐 Lovspark（Toolbar / Library / Agent / Skills / 节点 / 缩放 / 设置），视觉用 Plane surface 原子 token 清洗
- 节点：image · sticky · text · frame · imagegen · comment；localStorage 持久化
- 生成 / Agent：Demo mock，不联网

## 后续 UI 迭代建议

1. 概览 KPI / 设计费卡片打磨  
2. 画布：真实生成管线、节点编辑、Frame 父子编组深化  
3. 建模/渲染阶段接占位 → 真服务  
4. 材料库筛选与列表视觉  
5. 品牌 Logo 替换 Plane mark  
