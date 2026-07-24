# 构境AI · formscape

设计师工作室 **Studio OS / AI ERP** Demo。

| | |
|--|--|
| 英文名 | **formscape** |
| 中文名 | **构境AI** |
| 主工程 | `formscape-app/` |

## 启动

```bash
cd formscape-app
nvm use 22
pnpm dev:local
```

- UI: http://127.0.0.1:3000/formscape  
- Mock API: http://127.0.0.1:8000  

## 架构

L1 Rail · L2 项目侧栏 · L3 主内容。业务 UI 在  
`formscape-app/apps/web/core/components/formscape/`。
