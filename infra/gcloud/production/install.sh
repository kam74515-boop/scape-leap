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
apt-get install -y caddy postgresql postgresql-contrib postgresql-16-pgvector rsync

install -d -m 0755 "${config_dir}" "${root_dir}" "${root_dir}/data" "${root_dir}/releases"
install -d -m 0700 "${root_dir}/backups"
chown -R "${deploy_user}:${deploy_user}" "${root_dir}"

read_existing() {
  local key="$1"
  [[ -f "${env_file}" ]] || return 0
  sed -n "s/^${key}=//p" "${env_file}" | tail -1
}

db_name="scapeleap"
db_user="scapeleap_app"
db_password="$(read_existing SCAPELEAP_DATABASE_PASSWORD)"
admin_email="$(read_existing SCAPELEAP_BOOTSTRAP_ADMIN_EMAIL)"
admin_password="$(read_existing SCAPELEAP_BOOTSTRAP_ADMIN_PASSWORD)"
audit_salt="$(read_existing SCAPELEAP_AUDIT_SALT)"
generated_admin_password=""

[[ -n "${db_password}" ]] || db_password="$(openssl rand -hex 24)"
[[ -n "${admin_email}" ]] || admin_email="admin@museart.cloud"
if [[ -z "${admin_password}" ]]; then
  admin_password="Fs!$(openssl rand -hex 12)9aA"
  generated_admin_password="${admin_password}"
fi
[[ -n "${audit_salt}" ]] || audit_salt="$(openssl rand -hex 32)"

if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${db_user}'" | grep -q 1; then
  runuser -u postgres -- createuser --login "${db_user}"
fi
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER ROLE ${db_user} WITH LOGIN PASSWORD '${db_password}'"
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='${db_name}'" | grep -q 1; then
  runuser -u postgres -- createdb --owner="${db_user}" --encoding=UTF8 "${db_name}"
fi
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "${db_name}" -c "CREATE EXTENSION IF NOT EXISTS vector"
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "${db_name}" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto"

cat >"${env_file}" <<EOF
SCAPELEAP_DEPLOY_USER=${deploy_user}
SCAPELEAP_DEPLOY_BRANCH=${deploy_branch}
SCAPELEAP_REPO_URL=${repo_url}
SCAPELEAP_ROOT=${root_dir}
SCAPELEAP_PUBLIC_URL=${public_url}
SCAPELEAP_DATABASE_PASSWORD=${db_password}
DATABASE_URL=postgresql://${db_user}:${db_password}@127.0.0.1:5432/${db_name}
DATABASE_POOL_SIZE=10
SCAPELEAP_BOOTSTRAP_ADMIN_EMAIL=${admin_email}
SCAPELEAP_BOOTSTRAP_ADMIN_PASSWORD=${admin_password}
SCAPELEAP_BOOTSTRAP_ADMIN_NAME=构境管理员
SCAPELEAP_AUDIT_SALT=${audit_salt}
SCAPELEAP_SIGNUP_ENABLED=false
PLANE_MOCK_API_HOST=127.0.0.1
PLANE_MOCK_API_PORT=8000
FS_DB_PATH=${root_dir}/data/formscape.db
FS_SQLITE_MIGRATION_PATH=${root_dir}/data/formscape.db
EOF
chmod 0600 "${env_file}"

install -m 0755 "${script_dir}/deploy.sh" /usr/local/bin/scapeleap-deploy
install -m 0755 "${script_dir}/deploy-wrapper.sh" /usr/local/sbin/scapeleap-deploy-wrapper
install -m 0755 "${script_dir}/backup.sh" /usr/local/sbin/scapeleap-backup
install -m 0644 "${script_dir}/Caddyfile" /etc/caddy/Caddyfile
install -m 0644 "${script_dir}/scapeleap-api.service" /etc/systemd/system/scapeleap-api.service
install -m 0644 "${script_dir}/scapeleap-backup.service" /etc/systemd/system/scapeleap-backup.service
install -m 0644 "${script_dir}/scapeleap-backup.timer" /etc/systemd/system/scapeleap-backup.timer
install -m 0644 "${script_dir}/scapeleap-deploy.service" /etc/systemd/system/scapeleap-deploy.service
install -m 0644 "${script_dir}/scapeleap-deploy.timer" /etc/systemd/system/scapeleap-deploy.timer

rm -f /etc/systemd/system/caddy.service.d/scapeleap.conf
caddy validate --config /etc/caddy/Caddyfile

systemctl daemon-reload
systemctl enable caddy.service postgresql.service scapeleap-api.service scapeleap-backup.timer scapeleap-deploy.timer
systemctl start scapeleap-deploy.service
systemctl restart scapeleap-api.service caddy.service

database_ready=false
for readiness_attempt in {1..30}; do
  if [[ "$(runuser -u postgres -- psql -At -d "${db_name}" -c \
    "SELECT to_regclass('public.entities') IS NOT NULL AND to_regclass('public.users') IS NOT NULL")" == "t" ]]; then
    database_ready=true
    break
  fi
  sleep 1
done
if [[ "${database_ready}" != "true" ]]; then
  echo "Database schema was not ready before the initial backup." >&2
  exit 1
fi

systemctl start scapeleap-backup.timer scapeleap-deploy.timer
systemctl start scapeleap-backup.service

echo "Production deployment installed for ${public_url}"
if [[ -n "${generated_admin_password}" ]]; then
  echo "ADMIN_EMAIL=${admin_email}"
  echo "ADMIN_TEMPORARY_PASSWORD=${generated_admin_password}"
else
  echo "Bootstrap admin credentials were preserved from the existing installation."
fi
