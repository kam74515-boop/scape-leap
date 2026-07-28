#!/usr/bin/env bash
# 无 Docker：构境 formscape 前端源码 + Mock API
# UI  http://127.0.0.1:3000
# API http://127.0.0.1:8000  (mock，仅保壳可开；完整业务后续接 formscape Rust 或真 API)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
command -v nvm >/dev/null 2>&1 && nvm use 22 >/dev/null || true

corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@11.3.0 --activate >/dev/null 2>&1 || true

if [[ ! -d node_modules ]]; then
  echo "pnpm install…"
  pnpm install --ignore-scripts
fi

if [[ ! -f apps/web/.env ]]; then
  cp apps/web/.env.example apps/web/.env
fi
# 强制 API 指向本地 mock（不依赖 Docker）
if grep -q '^VITE_API_BASE_URL=' apps/web/.env 2>/dev/null; then
  sed -i.bak 's|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL="http://127.0.0.1:8000"|' apps/web/.env
else
  echo 'VITE_API_BASE_URL="http://127.0.0.1:8000"' >> apps/web/.env
fi
# WEB base
if grep -q '^VITE_WEB_BASE_URL=' apps/web/.env 2>/dev/null; then
  sed -i.bak 's|^VITE_WEB_BASE_URL=.*|VITE_WEB_BASE_URL="http://127.0.0.1:3000"|' apps/web/.env
fi

# 只清 3000/8000，不动 Docker
for p in 3000 8000; do
  lsof -ti :"$p" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
done
sleep 0.4

echo "→ Mock API :8000（无 Docker）"
node scripts/mock-api.mjs > /tmp/plane-mock-api.log 2>&1 &
echo $! > /tmp/plane-mock-api.pid

echo "→ Plane Web :3000（改 formscape-app 源码）"
cd apps/web
# 0.0.0.0：localhost 与 127.0.0.1 都能打开（避免只绑 127.0.0.1 时 localhost 走 IPv6 失败）
pnpm exec react-router dev --port 3000 --host 0.0.0.0 > /tmp/plane-web-dev.log 2>&1 &
echo $! > /tmp/plane-web-dev.pid

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf -o /dev/null http://127.0.0.1:3000/ && curl -sf -o /dev/null http://127.0.0.1:8000/api/instances/; then
    break
  fi
  sleep 1
done

echo ""
echo "============================================"
echo "  无 Docker 开发（基于 Plane 源码）"
echo "  UI:  http://127.0.0.1:3000"
echo "  API: http://127.0.0.1:8000  (mock)"
echo "  改代码: formscape-app/apps/web 等"
echo "  停服: kill \$(cat /tmp/plane-web-dev.pid /tmp/plane-mock-api.pid)"
echo "============================================"
curl -s -o /dev/null -w "web %{http_code}  " http://127.0.0.1:3000/ || true
curl -s -o /dev/null -w "api %{http_code}\n" http://127.0.0.1:8000/api/instances/ || true

# 前台挂住（Ctrl+C 时清理）
cleanup() {
  kill "$(cat /tmp/plane-web-dev.pid 2>/dev/null)" 2>/dev/null || true
  kill "$(cat /tmp/plane-mock-api.pid 2>/dev/null)" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
wait
