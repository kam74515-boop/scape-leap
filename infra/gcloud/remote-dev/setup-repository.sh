#!/usr/bin/env bash
set -Eeuo pipefail

readonly repo_url="git@github.com:kam74515-boop/scape-leap.git"
readonly repo_dir="${SCAPELEAP_REPO_DIR:-${HOME}/scape-leap}"
readonly branch="${1:-codex/gcloud-remote-dev}"
readonly key_path="${HOME}/.ssh/scapeleap_github_ed25519"

install -d -m 0700 "${HOME}/.ssh"

if [[ ! -f "${key_path}" ]]; then
  ssh-keygen -q -t ed25519 -N "" -C "scapeleap-dev" -f "${key_path}"
  echo "Deploy key created. Add this public key to the GitHub repository, then rerun:"
  cat "${key_path}.pub"
  exit 2
fi

if ! grep -q "IdentityFile ${key_path}" "${HOME}/.ssh/config" 2>/dev/null; then
  cat >>"${HOME}/.ssh/config" <<EOF

Host github.com
  HostName github.com
  User git
  IdentityFile ${key_path}
  IdentitiesOnly yes
EOF
  chmod 0600 "${HOME}/.ssh/config"
fi

github_meta="$(mktemp)"
trap 'rm -f "${github_meta}"' EXIT
curl --fail --silent --show-error https://api.github.com/meta |
  jq -r '.ssh_keys[] | "github.com \(.)"' >"${github_meta}"
cat "${github_meta}" >>"${HOME}/.ssh/known_hosts"
sort -u -o "${HOME}/.ssh/known_hosts" "${HOME}/.ssh/known_hosts"
chmod 0600 "${HOME}/.ssh/known_hosts"

if [[ ! -d "${repo_dir}/.git" ]]; then
  git clone --branch "${branch}" --single-branch "${repo_url}" "${repo_dir}"
else
  git -C "${repo_dir}" fetch origin "${branch}"
  git -C "${repo_dir}" switch "${branch}"
  git -C "${repo_dir}" pull --ff-only origin "${branch}"
fi

git -C "${repo_dir}" config user.name "kam74515-boop"
git -C "${repo_dir}" config user.email "kam74515@gmail.com"

sudo usermod -aG docker "${USER}"

cd "${repo_dir}/formscape-app"
corepack enable
corepack install --global "pnpm@11.3.0"
pnpm install --frozen-lockfile

echo "Repository ready at ${repo_dir}"
echo "Reconnect once so Docker group membership takes effect."
