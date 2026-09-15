import { isDetectionWeak } from "../domain/detection-quality"
import { reviewDiagnosticViewIds } from "../domain/review-diagnostics"
import type { PhotoPose, ViewId } from "../domain/types"
import type { ViewSet } from "../domain/view-set"

export type ReviewIssueKind =
  | "detectionWeak"
  | "analysisFailure"
  | "lateralityConflict"
  | "mixup"
  | "poseMismatch"
  | "diagnostic"

export type ReviewIssue = {
  readonly kind: ReviewIssueKind
  readonly view: ViewId
}

export type ReviewQueueItem = {
  readonly reasons: readonly ReviewIssueKind[]
  readonly view: ViewId
}

export type WorkspaceReviewSources = {
  readonly dismissedDiagnosticKeys: readonly string[]
  readonly failures: readonly { readonly view: ViewId }[]
  readonly lateralityConflictViews: readonly ViewId[]
  readonly mixupViews: readonly ViewId[]
  readonly photos: readonly { readonly pose: PhotoPose; readonly view: ViewId }[]
  readonly poseMismatchViews: readonly ViewId[]
}

export function buildReviewQueue(
  viewSet: ViewSet,
  issues: readonly ReviewIssue[],
): readonly ReviewQueueItem[] {
  return viewSet.views.flatMap((view) => {
    const reasons = [
      ...new Set(issues.filter((issue) => issue.view === view).map(({ kind }) => kind)),
    ]
    return reasons.length === 0 ? [] : [{ reasons, view }]
  })
}

export function buildWorkspaceReviewQueue(
  viewSet: ViewSet,
  sources: WorkspaceReviewSources,
): readonly ReviewQueueItem[] {
  const issues = [
    ...sources.photos
      .filter((photo) => isDetectionWeak(photo.view, photo.pose.confidence))
      .map(({ view }) => ({ kind: "detectionWeak", view }) as const),
    ...sources.failures.map(({ view }) => ({ kind: "analysisFailure", view }) as const),
    ...sources.lateralityConflictViews.map(
      (view) =>
        ({
          kind: "lateralityConflict",
          view,
        }) as const,
    ),
    ...sources.mixupViews.map((view) => ({ kind: "mixup", view }) as const),
    ...sources.poseMismatchViews.map((view) => ({ kind: "poseMismatch", view }) as const),
    ...reviewDiagnosticViewIds(sources.photos, sources.dismissedDiagnosticKeys).map(
      (view) => ({ kind: "diagnostic", view }) as const,
    ),
  ] satisfies readonly ReviewIssue[]
  return buildReviewQueue(viewSet, issues)
}

export function nextReviewView(
  queue: readonly ReviewQueueItem[],
  currentView: ViewId,
): ViewId | null {
  if (queue.length === 0) {
    return null
  }
  const currentIndex = queue.findIndex(({ view }) => view === currentView)
  return queue[(currentIndex + 1) % queue.length]?.view ?? null
}

export function previousReviewView(
  queue: readonly ReviewQueueItem[],
  currentView: ViewId,
): ViewId | null {
  if (queue.length === 0) {
    return null
  }
  const currentIndex = queue.findIndex(({ view }) => view === currentView)
  const previousIndex =
    currentIndex < 0 ? queue.length - 1 : (currentIndex - 1 + queue.length) % queue.length
  return queue[previousIndex]?.view ?? null
}
