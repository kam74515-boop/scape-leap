# 构境AI · formscape-app

主前端（原 `plane-app` 已更名）。

## 启动

```bash
cd formscape-app
nvm use 22
pnpm dev:local
```

- UI: http://127.0.0.1:3000  
- Mock: http://127.0.0.1:8000  
- 工作区: `/formscape`

## L1 / L2 / L3

| 层 | 内容 |
|----|------|
| L1 | 项目、画布、客户、资源、团队、设置 + 账号 |
| L2 | 项目子导航：概览、设计流程、Work items、汇报、文件 |
| L3 | 各业务 Demo 页 + AI drawer |

业务组件：`apps/web/core/components/formscape/`  
画布：`apps/web/core/components/formscape/canvas/`  
- 引擎 `@xyflow/react` · Lovspark 功能壳 · Plane token 视觉  
- 技能库 15 项（风格渲染 / 空房 / 多角度 / 分镜 / 材质替换…）+ Skill Rail 填空生成  
- 工具：选择/平移/画板/形状/文字/便签/评论/生成/上传 · 素材库 · 右键菜单 · 撤销重做  

扩展路由：`apps/web/app/routes/extended.ts`
