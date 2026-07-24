# 构境AI · 现状页面导图（Plane 对齐版）

> Demo 前端按 [makeplane/plane](https://github.com/makeplane/plane) 壳结构重构  
> 参考源码：`refs/plane/`（sparse clone）  
> 后端 API **未改** · 入口：http://127.0.0.1:8080

---

## 核心原则（来自 Plane）

| Plane | 构境映射 |
|---|---|
| 工作区壳固定，`ProjectAppSidebar` + `main > Outlet` | 侧栏永不换成「另一套 App」 |
| Projects 列表可展开 Disclosure | 侧栏 **Projects** 下点项目展开子导航 |
| 项目内 Work items / Cycles / Pages… | Overview / 需求 / 风格 / 画布 / 建模 / … |
| 客户不是一级菜单 | 客户 = 项目 `profile` 字段 |

---

## 一级 / 二级界面

```
L0  应用壳（圆角主区 + 侧栏）
│
├─ L1 侧栏 · 固定
│   ├─ Workspace 徽章
│   ├─ New project
│   ├─ Home（项目总览表）
│   ├─ 资源库
│   ├─ 团队
│   ├─ Projects（列表）
│   │    └─ L2  项目 A ▾（展开）
│   │         ├─ L3  Overview
│   │         ├─ L3  需求 / 风格 / 画布 / 建模 / 渲染 / 材料 / 家具 / 施工
│   │         └─ L3  汇报 / 文件 / 任务
│   └─ Settings（底部）
│
└─ L1 主区 · Outlet
     ├─ Home：Projects 表格（点行 = 展开侧栏项目 + 打开 Overview）
     ├─ 资源库 / 团队 / Settings 页
     └─ 项目内容：Header + 可选阶段条 + 内容
```

---

## 交互

```
Home 表格点行 ──► 侧栏展开该项目 + 主区 Overview
侧栏再点子导航 ──► 仅换主区内容
再点项目标题 ──► 收起 / 关闭项目（回 Home）
点 Home ────────► closeProject + 项目总览表
```

---

## 与旧版差异

| 旧 | 现（Plane） |
|---|---|
| 点项目换一整套侧栏 | 侧栏结构不变，项目下展开子链 |
| 客户一级模块 | 客户字段在需求档案 |
| 设置一级 | Settings 沉底 |
| 卡片墙为主 | Home 以 **表格** 为主（Plane Projects 感） |

---

## 代码

| 文件 | 职责 |
|---|---|
| `components/Sidebar.tsx` | Plane 侧栏 + 可展开项目导航 |
| `components/Dashboard.tsx` | Projects Home 表 |
| `components/Workspace.tsx` | 项目 Outlet 内容 |
| `App.tsx` | 壳：sidebar + main |
| `refs/plane/` | 上游参考（不参与构建） |

后端：`formscape-demo/server` **无改动**。
