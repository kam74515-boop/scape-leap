# refs/

外部参考实现（只读对照，不参与 formscape 构建）。

| 目录 | 来源 | 用途 |
|---|---|---|
| `plane/` | Plane CE | UI 壳 / 产品 fork 源 |
| `grok-build/` | [xai-org/grok-build](https://github.com/xai-org/grok-build) Apache-2.0 | 编码 agent harness 语义对照 |

## grok-build → 构境

构境 **不** 嵌入 Rust TUI，而是把 harness 语义移植到 Web：

- 见 `formscape-app/apps/web/core/components/formscape/agent/ARCHITECTURE.md`
- 项目边界 = workspace；tools / skills / turn runtime 已落地 Demo

更新对照源：

```sh
cd refs/grok-build && git pull --ff-only
```
