#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  start|stop|restart|status) action="$1" ;;
  *) echo "Usage: bash scripts/cloud.sh {start|stop|restart|status}" >&2; exit 2 ;;
esac
command -v gcloud >/dev/null || { echo "gcloud is required." >&2; exit 1; }
project="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "$project" || "$project" == "(unset)" ]]; then
  echo "Set GCP_PROJECT_ID or run: gcloud config set project PROJECT_ID" >&2
  exit 1
fi
region="${GCP_REGION:-europe-west1}"
echo "Action: $action; project: $project; region: $region"

stop() {
  gcloud run services update tenisu-api --project="$project" --region="$region" --scaling=0 --quiet
  gcloud sql instances patch tenisu-postgres --project="$project" --activation-policy=NEVER --quiet
  echo "API disabled and database stopped. Data is preserved; storage charges continue."
}
start() {
  gcloud sql instances patch tenisu-postgres --project="$project" --activation-policy=ALWAYS --quiet
  gcloud run services update tenisu-api --project="$project" --region="$region" --scaling=auto --min=0 --max=1 --quiet
  gcloud run services describe tenisu-api --project="$project" --region="$region" --format='value(status.url)'
}
case "$action" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status)
    gcloud run services describe tenisu-api --project="$project" --region="$region" --format=yaml
    gcloud sql instances describe tenisu-postgres --project="$project" --format='yaml(state,settings.activationPolicy)'
    ;;
esac
