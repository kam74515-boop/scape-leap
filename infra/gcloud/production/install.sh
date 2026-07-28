#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

readonly deploy_user="${SCAPELEAP_DEPLOY_USER:-karld74515_gmail_com}"
readonly deploy_branch="${SCAPELEAP_DEPLOY_BRANCH:-codex/gcloud-remote-dev}"
readonly repo_url="${SCAPELEAP_REPO_URL:-git@github.com:kam74515-boop/scape-leap.git}"
readonly public_url="${SCAPELEAP_PUBLIC_URL:-https://museart.cloud}"
readonly root_dir="${SCAPELEAP_ROOT:-/srv/scapeleap}"
readonly config_dir="/etc/scapeleap"
readonly env_file="${config_dir}/production.env"
readonly script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

id "${deploy_user}" >/dev/null

apt-get update
apt-get install -y caddy rsync

install -d -m 0755 "${config_dir}" "${root_dir}" "${root_dir}/data" "${root_dir}/releases"
chown -R "${deploy_user}:${deploy_user}" "${root_dir}"

auth_user="museart"
auth_password=""
auth_hash=""
if [[ -f "${env_file}" ]]; then
  auth_user="$(sed -n 's/^SCAPELEAP_BASIC_AUTH_USER=//p' "${env_file}" | tail -1)"
  auth_hash="$(sed -n 's/^SCAPELEAP_BASIC_AUTH_HASH=//p' "${env_file}" | tail -1)"
fi
if [[ -z "${auth_user}" || -z "${auth_hash}" ]]; then
  auth_user="museart"
  auth_password="$(openssl rand -base64 18 | tr -d '\n')"
  auth_hash="$(caddy hash-password --plaintext "${auth_password}")"
fi

cat >"${env_file}" <<EOF
SCAPELEAP_DEPLOY_USER=${deploy_user}
SCAPELEAP_DEPLOY_BRANCH=${deploy_branch}
SCAPELEAP_REPO_URL=${repo_url}
SCAPELEAP_ROOT=${root_dir}
SCAPELEAP_PUBLIC_URL=${public_url}
SCAPELEAP_BASIC_AUTH_USER=${auth_user}
SCAPELEAP_BASIC_AUTH_HASH=${auth_hash}
PLANE_MOCK_API_HOST=127.0.0.1
PLANE_MOCK_API_PORT=8000
FS_DB_PATH=${root_dir}/data/formscape.db
EOF
chmod 0600 "${env_file}"

install -m 0755 "${script_dir}/deploy.sh" /usr/local/bin/scapeleap-deploy
install -m 0755 "${script_dir}/deploy-wrapper.sh" /usr/local/sbin/scapeleap-deploy-wrapper
install -m 0644 "${script_dir}/Caddyfile" /etc/caddy/Caddyfile
install -m 0644 "${script_dir}/scapeleap-api.service" /etc/systemd/system/scapeleap-api.service
install -m 0644 "${script_dir}/scapeleap-deploy.service" /etc/systemd/system/scapeleap-deploy.service
install -m 0644 "${script_dir}/scapeleap-deploy.timer" /etc/systemd/system/scapeleap-deploy.timer

install -d -m 0755 /etc/systemd/system/caddy.service.d
cat >/etc/systemd/system/caddy.service.d/scapeleap.conf <<EOF
[Service]
EnvironmentFile=${env_file}
EOF

export SCAPELEAP_BASIC_AUTH_USER="${auth_user}"
export SCAPELEAP_BASIC_AUTH_HASH="${auth_hash}"
caddy validate --config /etc/caddy/Caddyfile

systemctl daemon-reload
systemctl enable caddy.service scapeleap-api.service scapeleap-deploy.timer
systemctl start scapeleap-deploy.service
systemctl restart scapeleap-api.service caddy.service
systemctl start scapeleap-deploy.timer

echo "Production deployment installed for ${public_url}"
if [[ -n "${auth_password}" ]]; then
  echo "PREVIEW_USERNAME=${auth_user}"
  echo "PREVIEW_PASSWORD=${auth_password}"
else
  echo "Preview credentials were preserved from the existing installation."
fi
