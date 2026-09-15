# Usage aggregation / 사용 집계

The official SevenView deployment uses a separate Cloudflare Worker and D1 database for
coarse event counts. It is not part of the static Pages request path and its failure must
not block the application.

## HTTP contract

- Endpoint: `POST https://<collector-host>/events`
- Required `Origin`: `https://sevenview.velnoc.com`
- Required `Content-Type`: `application/json`
- Maximum decoded request body: 64 bytes
- Exact body: `{"event":"landing_visit"}`, `{"event":"app_use"}`, or
  `{"event":"export_complete"}`
- Extra keys and all other values are rejected. Successful writes return `204`.
- CORS preflight permits only `POST` and `Content-Type` for the official origin.
- There is no public read or report route.

The payload must never contain photos, names, filenames, patient identifiers, measurements,
DOM content, interaction coordinates, URLs, referrers, cookies, or user/session identifiers.
Counts represent events, not unique people. `export_complete` means the browser accepted the
download handoff, not that a file was written to disk.

## Stored schema and retention

D1 stores only `day`, `event`, and `count`, keyed by UTC day and the fixed event name. Each
accepted request atomically increments one aggregate row and removes rows older than the
current 90-day window. At most 270 day/event rows are retained under normal operation.

Cloudflare processes request transport metadata such as IP addresses. The Worker does not
read that metadata into the payload or database, does not call `console.*`, and explicitly
disables Workers Logs and invocation logs in its Wrangler configuration.

## Local verification

The collector is an independent pnpm package so the static application dependencies remain
unchanged.

```bash
cd telemetry-server
pnpm install --ignore-workspace --frozen-lockfile
pnpm typecheck
pnpm test
pnpm test:csp
```

The integration test starts one local Worker process, uses a real local D1 database, exercises
the HTTP boundary, then stops the process and removes its temporary state.

## Free-plan deployment and private reporting

Before creating resources, verify the Cloudflare dashboard marks Workers **Free / Current
plan**. Do not upgrade. Free limits are account-wide, so collector failure at a limit is an
expected unavailable-telemetry condition rather than a reason to route the static app through
the Worker.

Use separate preview and production Worker/D1 names. Apply migrations before deploying the
matching Worker. Never add a report HTTP route or commit an API token. An authenticated operator
can read preview aggregates with:

```bash
cd telemetry-server
pnpm report:preview
```

The command uses the current Wrangler OAuth session and returns only aggregate rows. Review
[Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) before deployment because
limits can change.
