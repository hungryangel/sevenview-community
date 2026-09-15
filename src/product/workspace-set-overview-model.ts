import type { ViewId } from "../domain/types"
import type { ReviewQueueItem } from "./review-queue"
import type { useWorkspace } from "./use-workspace"
import { failureMetaKey } from "./workspace-analysis-result"

export type WorkspaceSetOverviewSource = Pick<
  ReturnType<typeof useWorkspace>,
  "viewSet" | "photos" | "failures" | "spares" | "trayFailures" | "getPhotoMeta"
>

export type SetViewStatus = "empty" | "failure" | "review" | "placed"

export type WorkspaceSetOverviewModel = {
  readonly captureDates: {
    readonly days: readonly string[]
    readonly knownCount: number
    readonly totalCount: number
  }
  readonly counts: {
    readonly included: number
    readonly missing: number
    readonly review: number
    readonly failed: number
    readonly spares: number
    readonly trayFailures: number
  }
  readonly views: readonly { readonly status: SetViewStatus; readonly view: ViewId }[]
}

export function buildWorkspaceSetOverview(
  workspace: WorkspaceSetOverviewSource,
  reviewQueue: readonly ReviewQueueItem[],
): WorkspaceSetOverviewModel {
  const activeViews = new Set(workspace.viewSet.views)
  const photos = workspace.photos.filter(({ view }) => activeViews.has(view))
  const failures = workspace.failures.filter(({ view }) => activeViews.has(view))
  const occupiedViews = new Set([...photos, ...failures].map(({ view }) => view))
  const reviewViews = new Set(
    reviewQueue.flatMap(({ view }) => (occupiedViews.has(view) ? [view] : [])),
  )
  const views = workspace.viewSet.views.map((view) => {
    const status: SetViewStatus = failures.some((failure) => failure.view === view)
      ? "failure"
      : !occupiedViews.has(view)
        ? "empty"
        : reviewViews.has(view)
          ? "review"
          : "placed"
    return { status, view }
  })
  const metadataKeys = [
    ...photos.map(({ pose }) => pose.id),
    ...failures.map(({ fileName }) => failureMetaKey(fileName)),
  ]
  const captureDays = metadataKeys.flatMap((key) => {
    const date = workspace.getPhotoMeta(key)?.captureTime
    if (date === undefined || date === null) return []
    return [
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    ]
  })
  return {
    captureDates: {
      days: [...new Set(captureDays)].toSorted(),
      knownCount: captureDays.length,
      totalCount: metadataKeys.length,
    },
    counts: {
      included: photos.length,
      missing: workspace.viewSet.views.length - occupiedViews.size,
      review: reviewViews.size,
      failed: failures.length,
      spares: workspace.spares.length + workspace.photos.length - photos.length,
      trayFailures: workspace.trayFailures.length + workspace.failures.length - failures.length,
    },
    views,
  }
}
