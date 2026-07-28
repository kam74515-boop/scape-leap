#!/usr/bin/env bash
set -Eeuo pipefail

readonly NODE_VERSION="22.18.0"
readonly PNPM_VERSION="11.3.0"
readonly MARKER_FILE="/var/lib/scapeleap/remote-dev-bootstrap.done"

if [[ -f "${MARKER_FILE}" ]]; then
  exit 0
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y \
  build-essential \
  ca-certificates \
  curl \
  docker-compose-v2 \
  docker.io \
  git \
  git-lfs \
  jq \
  python3 \
  python3-venv \
  ripgrep \
  tmux \
  unzip \
  xz-utils

systemctl enable --now docker
git lfs install --system

case "$(dpkg --print-architecture)" in
  amd64) node_arch="x64" ;;
  arm64) node_arch="arm64" ;;
  *)
    echo "Unsupported architecture: $(dpkg --print-architecture)" >&2
    exit 1
    ;;
esac

node_archive="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"
node_url="https://nodejs.org/dist/v${NODE_VERSION}/${node_archive}"
node_dir="/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-${node_arch}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

curl --fail --location --retry 3 --output "${tmp_dir}/${node_archive}" "${node_url}"
mkdir -p /usr/local/lib/nodejs
tar -xJf "${tmp_dir}/${node_archive}" -C /usr/local/lib/nodejs

ln -sfn "${node_dir}/bin/node" /usr/local/bin/node
ln -sfn "${node_dir}/bin/npm" /usr/local/bin/npm
ln -sfn "${node_dir}/bin/npx" /usr/local/bin/npx
ln -sfn "${node_dir}/bin/corepack" /usr/local/bin/corepack

corepack enable
corepack install --global "pnpm@${PNPM_VERSION}"

cat >/etc/sysctl.d/99-scapeleap-remote-dev.conf <<'EOF'
fs.inotify.max_user_instances=1024
fs.inotify.max_user_watches=524288
EOF
sysctl --system

cat >/etc/profile.d/scapeleap-remote-dev.sh <<EOF
export SCAPELEAP_NODE_VERSION="${NODE_VERSION}"
export SCAPELEAP_PNPM_VERSION="${PNPM_VERSION}"
EOF

install -d -m 0755 "$(dirname "${MARKER_FILE}")"
date --iso-8601=seconds >"${MARKER_FILE}"
