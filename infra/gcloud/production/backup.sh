#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

readonly backup_dir="${SCAPELEAP_ROOT:-/srv/scapeleap}/backups"
readonly timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
readonly final_file="${backup_dir}/scapeleap-${timestamp}.dump"
readonly temp_file="${final_file}.tmp"

install -d -m 0700 "${backup_dir}"
pg_dump --dbname="${DATABASE_URL}" --format=custom --compress=9 --no-owner --file="${temp_file}"
mv -f "${temp_file}" "${final_file}"
find "${backup_dir}" -type f -name 'scapeleap-*.dump' -mtime +14 -delete

echo "Created ${final_file}"
