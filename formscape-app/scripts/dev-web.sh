#!/usr/bin/env bash
# 构境主前端：Plane Web 单一入口 http://127.0.0.1:3000
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
command -v nvm >/dev/null 2>&1 && nvm use 22 >/dev/null

corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@11.3.0 --activate >/dev/null 2>&1 || true

if [[ ! -d node_modules ]]; then
  echo "pnpm install…"
  pnpm install --ignore-scripts
fi

if [[ ! -f apps/web/.env ]]; then
  cp apps/web/.env.example apps/web/.env
  echo "已创建 apps/web/.env"
fi

# 清掉旧自研 demo 端口干扰（可选）
for p in 5173 5174; do
  lsof -ti :"$p" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
done

echo "Plane Web → http://127.0.0.1:3000"
exec pnpm --filter=web dev
