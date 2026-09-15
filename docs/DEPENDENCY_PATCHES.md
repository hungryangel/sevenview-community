# Dependency patches

## `@mediapipe/tasks-vision@1.0.1`

SevenView uses a pnpm patch at
[`patches/@mediapipe__tasks-vision@1.0.1.patch`](../patches/@mediapipe__tasks-vision@1.0.1.patch).
The upstream Tasks Vision web bundle initializes a reporter that sends performance and utilization
metrics to `https://odml.pa.googleapis.com/v1/log`. The patch replaces only that initializer with
a no-op; the reporter is optional at its call sites, and the local face-landmark inference path is
unchanged.

The patch is required for the Community product boundary: no external requests while processing
clinical photos. `e2e/offline-workspace.spec.ts` blocks every non-local origin and verifies the
complete local upload, sort, and export flow.

Do not carry this patch across a dependency upgrade blindly. Review the upgraded bundle and its
license or privacy behavior, update this record, then rerun `pnpm check` and the offline E2E.
