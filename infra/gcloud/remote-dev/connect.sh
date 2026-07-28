#!/usr/bin/env bash
set -Eeuo pipefail

readonly project_id="${GCP_PROJECT_ID:-project-f76e7635-e511-4c7e-995}"
readonly zone="${GCP_ZONE:-asia-east1-a}"
readonly instance="${GCP_INSTANCE:-scapeleap-dev}"

exec gcloud compute ssh "${instance}" \
  --project="${project_id}" \
  --zone="${zone}" \
  --tunnel-through-iap \
  -- \
  -L 3000:127.0.0.1:3000 \
  -L 3001:127.0.0.1:3001 \
  -L 8000:127.0.0.1:8000 \
  -L 8090:127.0.0.1:8090
