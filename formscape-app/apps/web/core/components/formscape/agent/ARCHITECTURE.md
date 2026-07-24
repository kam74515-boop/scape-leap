# 构境 Agent Harness · 与 Grok Build 对齐

## 定位

构境 Web 内的 AI **不是聊天装饰**，而是 **基于项目制管理的 harness**：

- **边界单位 = 项目**（非 git repo）
- **状态源 = 双轴进度 + 采购清单 + 档案**（localStorage Demo → 未来 API）
- **可调用能力 = tools**，**场景包 = skills**

上游参考实现（已 vendor 源码作对照，不直接嵌 Rust TUI）：

```
refs/grok-build/   # https://github.com/xai-org/grok-build  Apache-2.0
```

## 概念映射

| Grok Build（Rust） | 构境 Web harness | 说明 |
|---|---|---|
| `xai-grok-workspace` | `ProjectHarnessContext` | 工作区 = 当前项目切片 |
| `xai-grok-tools` | `agent/tools.ts` | 工具注册表 |
| skills / plugins | `agent/skills.ts` | 经营 / 阶段 / 采购 / 画布 |
| `xai-grok-shell` runtime | `agent/runtime.ts` | 一轮 turn：match skill → tools → 回复 |
| TUI pager | `AiDrawer` + `ai-context` | Studio 右侧停靠面板 |
| MCP / subagents | （规划） | 经营子代理 / 采购子代理 / 设计子代理 |
| headless | （规划） | 批处理：周报、清单导出 |

## 工具（当前）

- `get_project_snapshot` — 双轴 + 设计费
- `list_stage_states` — 七段三态
- `list_project_purchase` — **与生态库同源**的项目采购
- `advance_biz_node` — 推进经营节点
- `suggest_next_actions` — 下一步建议

## 采购同源

```
生态库 LibraryPage (mode=purchase)
        ↓  fs-eco-purchase-v1
项目阶段 家具采买 StagesPage
        ↓
Agent tool list_project_purchase
```

## 演进路径

1. **现在**：规则 skill 路由 + 同步工具（可演示闭环）
2. **下一步**：LLM tool-calling 替换 `runHarnessTurn` 内路由，工具表不动
3. **中期**：从 `refs/grok-build` 抽语义（hooks、session、memory）移植到 TS
4. **不做**：把整个 Rust TUI 嵌进 Plane；Studio UI 仍是 React

## 修改约定

- 新业务能力优先加 **tool**，再挂到 **skill**
- 禁止 agent 直接改 UI state；只经 store / API
- 项目外上下文（工作室级）工具单独命名 `studio_*`，勿与 `project_*` 混用
