#!/usr/bin/env bash
set -Eeuo pipefail

: "${SCAPELEAP_DEPLOY_USER:?SCAPELEAP_DEPLOY_USER is required}"
: "${SCAPELEAP_DEPLOY_BRANCH:?SCAPELEAP_DEPLOY_BRANCH is required}"
: "${SCAPELEAP_REPO_URL:?SCAPELEAP_REPO_URL is required}"
: "${SCAPELEAP_PUBLIC_URL:?SCAPELEAP_PUBLIC_URL is required}"

readonly root_dir="${SCAPELEAP_ROOT:-/srv/scapeleap}"
readonly revision_file="${root_dir}/deployed-revision"
readonly deploy_home="$(getent passwd "${SCAPELEAP_DEPLOY_USER}" | cut -d: -f6)"

before_revision="$(tr -d '\n' <"${revision_file}" 2>/dev/null || true)"

runuser -u "${SCAPELEAP_DEPLOY_USER}" -- \
  env \
  HOME="${deploy_home}" \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  SCAPELEAP_DEPLOY_BRANCH="${SCAPELEAP_DEPLOY_BRANCH}" \
  SCAPELEAP_REPO_URL="${SCAPELEAP_REPO_URL}" \
  SCAPELEAP_ROOT="${root_dir}" \
  SCAPELEAP_PUBLIC_URL="${SCAPELEAP_PUBLIC_URL}" \
  /usr/local/bin/scapeleap-deploy

after_revision="$(tr -d '\n' <"${revision_file}" 2>/dev/null || true)"
if [[ -n "${after_revision}" && "${after_revision}" != "${before_revision}" ]]; then
  systemctl restart scapeleap-api.service
fi
