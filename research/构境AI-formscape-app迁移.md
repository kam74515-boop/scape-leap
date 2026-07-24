# plane-app → formscape-app 迁移记录

> 2026-07-23

## 变更

1. 目录 `plane-app/` 重命名为 **`formscape-app/`**
2. 删除 **`formscape-demo/`**（旧自研壳）
3. 主前端唯一入口：`formscape-app`

## L1–L3 Demo 已接通

| 层 | 路由示例 |
|----|----------|
| L1 项目 | `/scapeleap` |
| L1 画布 | `/scapeleap/canvas` |
| L1 客户 | `/scapeleap/customers` |
| L1 资源 | `/scapeleap/library` |
| L1 团队 | `/scapeleap/team` |
| L1 设置 | `/scapeleap/studio-settings` |
| L3 概览 | `.../projects/proj-demo-1/overview` |
| L3 阶段 | `.../stages/requirements` |
| L3 看板 | `.../issues` |
| L3 汇报 | `.../ppt` |
| L3 文件 | `.../files` |

代码：`formscape-app/apps/web/core/components/formscape/`
