#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state_dir="$(mktemp -d "${TMPDIR:-/tmp}/sevenview-usage-test.XXXXXX")"
port="$((20000 + ($$ % 10000)))"
worker_pid=""

cleanup() {
  if [[ -n "$worker_pid" ]]; then
    kill "$worker_pid" 2>/dev/null || true
    wait "$worker_pid" 2>/dev/null || true
  fi
  rm -rf "$state_dir"
}
trap cleanup EXIT

cd "$root_dir"
pnpm exec wrangler d1 migrations apply sevenview-usage-preview --local --persist-to "$state_dir"
pnpm exec wrangler d1 execute sevenview-usage-preview --local --persist-to "$state_dir" \
  --command "INSERT INTO daily_counts(day, event, count) VALUES ('2000-01-01', 'landing_visit', 9)"

pnpm exec wrangler dev --local --port "$port" --persist-to "$state_dir" >"$state_dir/worker.log" 2>&1 &
worker_pid="$!"

for _ in {1..50}; do
  if curl --silent --fail -X OPTIONS "http://127.0.0.1:$port/events" \
    -H "Origin: https://sevenview.velnoc.com" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$worker_pid" 2>/dev/null; then
    cat "$state_dir/worker.log"
    exit 1
  fi
  sleep 0.1
done

request() {
  curl --silent --output "$state_dir/body" --write-out "%{http_code}" "$@"
}

allowed_origin="https://sevenview.velnoc.com"
base_url="http://127.0.0.1:$port"

status="$(request -X POST "$base_url/events" -H "Origin: $allowed_origin" \
  -H "Content-Type: application/json" --data '{"event":"landing_visit"}')"
[[ "$status" == "204" ]]

status="$(request -X POST "$base_url/events" -H "Origin: $allowed_origin" \
  -H "Content-Type: application/json" --data '{"event":"app_use","url":"/app"}')"
[[ "$status" == "400" ]]

status="$(request -X POST "$base_url/events" -H "Origin: $allowed_origin" \
  -H "Content-Type: application/json" --data '{"event":"unknown"}')"
[[ "$status" == "400" ]]

status="$(request -X POST "$base_url/events" -H "Origin: https://example.com" \
  -H "Content-Type: application/json" --data '{"event":"app_use"}')"
[[ "$status" == "403" ]]

status="$(request -X POST "$base_url/events" -H "Origin: $allowed_origin" \
  -H "Content-Type: application/json" --data "$(printf '{\"event\":\"app_use\",\"padding\":\"%080d\"}' 0)")"
[[ "$status" == "413" ]]

status="$(request "$base_url/report" -H "Origin: $allowed_origin")"
[[ "$status" == "404" ]]

status="$(request -X OPTIONS "$base_url/events" -H "Origin: $allowed_origin" \
  -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type")"
[[ "$status" == "204" ]]

kill "$worker_pid"
wait "$worker_pid" 2>/dev/null || true
worker_pid=""

report="$(pnpm exec wrangler d1 execute sevenview-usage-preview --local --persist-to "$state_dir" \
  --json --command "SELECT day, event, count FROM daily_counts ORDER BY day, event")"
node -e '
  const report = JSON.parse(process.argv[1]);
  const rows = report[0].results;
  if (rows.length !== 1) process.exit(1);
  if (rows[0].event !== "landing_visit" || rows[0].count !== 1) process.exit(1);
' "$report"

echo "PASS: exact event schema, origin guard, request bound, private reads, atomic count, retention"
