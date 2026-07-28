#!/usr/bin/env bash
set -Eeuo pipefail

: "${SCAPELEAP_DEPLOY_BRANCH:?SCAPELEAP_DEPLOY_BRANCH is required}"
: "${SCAPELEAP_REPO_URL:?SCAPELEAP_REPO_URL is required}"
: "${SCAPELEAP_PUBLIC_URL:?SCAPELEAP_PUBLIC_URL is required}"

readonly root_dir="${SCAPELEAP_ROOT:-/srv/scapeleap}"
readonly source_dir="${root_dir}/source"
readonly releases_dir="${root_dir}/releases"
readonly current_link="${root_dir}/current"
readonly revision_file="${root_dir}/deployed-revision"

install -d -m 0755 "${root_dir}" "${releases_dir}"

if [[ ! -d "${source_dir}/.git" ]]; then
  git clone --branch "${SCAPELEAP_DEPLOY_BRANCH}" --single-branch "${SCAPELEAP_REPO_URL}" "${source_dir}"
else
  git -C "${source_dir}" fetch origin "${SCAPELEAP_DEPLOY_BRANCH}"
  git -C "${source_dir}" switch "${SCAPELEAP_DEPLOY_BRANCH}"
  git -C "${source_dir}" merge --ff-only "origin/${SCAPELEAP_DEPLOY_BRANCH}"
fi

revision="$(git -C "${source_dir}" rev-parse HEAD)"
if [[ -f "${revision_file}" ]] &&
  [[ "$(tr -d '\n' <"${revision_file}")" == "${revision}" ]] &&
  [[ -f "${current_link}/index.html" ]]; then
  echo "Already deployed ${revision}"
  exit 0
fi

cd "${source_dir}/formscape-app"
export VITE_API_BASE_URL=""
export VITE_WEB_BASE_URL="${SCAPELEAP_PUBLIC_URL}"
pnpm install --frozen-lockfile
pnpm exec turbo run build --filter="web^..."
pnpm --filter=web test
pnpm --filter=web check:types
pnpm --filter=@plane/utils check:types
pnpm build:web

release_dir="${releases_dir}/${revision}-$(date +%s)"
install -d -m 0755 "${release_dir}"
rsync -a "apps/web/build/client/" "${release_dir}/"
test -f "${release_dir}/index.html"

next_link="${root_dir}/.current-${revision}-$$"
ln -s "${release_dir}" "${next_link}"
mv -Tf "${next_link}" "${current_link}"

revision_tmp="${revision_file}.$$"
printf '%s\n' "${revision}" >"${revision_tmp}"
mv -f "${revision_tmp}" "${revision_file}"

echo "Deployed ${revision} to ${release_dir}"
