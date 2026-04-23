#!/usr/bin/env bash
# Helper: notify the Supabase build-webhook of step progress.
# Usage: ./notify.sh <event> <step_key> [detail]
#   event = step_start | step_done | step_fail
set -euo pipefail
EVENT="$1"
STEP="$2"
DETAIL="${3:-}"

curl -fsS -X POST "$CALLBACK_URL" \
  -H "Content-Type: application/json" \
  -H "x-build-secret: $WEBHOOK_SECRET" \
  -d "$(jq -nc \
    --arg id "$BUILD_ID" \
    --arg ev "$EVENT" \
    --arg step "$STEP" \
    --arg detail "$DETAIL" \
    --arg run_id "${GITHUB_RUN_ID:-}" \
    --arg run_url "$RUN_URL" \
    --arg secret "$WEBHOOK_SECRET" \
    '{event:$ev, build_id:$id, step_key:$step, detail:$detail, github_run_id:$run_id, github_run_url:$run_url, secret:$secret}')" \
  > /dev/null || echo "notify failed (non-fatal)"
