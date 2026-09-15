import { useCallback, useEffect, useRef, useState } from "react"
import { reviewDiagnostics } from "../domain/review-diagnostics"
import type { ViewId } from "../domain/types"
import {
  detectViewPoseMismatch,
  measuredPitchMedian,
  type PoseMismatch,
  suggestViewForPose,
} from "../domain/view-plausibility"
import { findLateralityConflicts } from "../domain/workspace"
import { buildWorkspaceReviewQueue, nextReviewView, previousReviewView } from "./review-queue"
import { useReviewShortcuts } from "./use-review-shortcuts"
import type { useWorkspace } from "./use-workspace"

export function useWorkspaceReview(workspace: ReturnType<typeof useWorkspace>, active: boolean) {
  const [inspectorOpenReason, setInspectorOpenReason] = useState<null | "manual" | "review">(null)
  const inspectorTriggerRef = useRef<HTMLElement | null>(null)
  const selectedPhoto = workspace.photos.find((photo) => photo.view === workspace.selectedView)
  const selectedFailure = workspace.failures.find(
    (failure) => failure.view === workspace.selectedView,
  )

  useEffect(() => {
    if (!active) setInspectorOpenReason(null)
  }, [active])

  // 검토 단축키: `\` 홀드 = 원본 비교, `[` `]` = 선택 사진 0.1° 회전(Shift 1°)(2026-09-03).
  useReviewShortcuts({
    enabled: active && workspace.phase === "review" && selectedPhoto !== undefined,
    onRotate: (rotationDegrees) => {
      if (selectedPhoto !== undefined) {
        workspace.updateAdjustment(workspace.selectedView, {
          ...selectedPhoto.adjustment,
          rotationDegrees,
        })
      }
    },
    reviewAlignment: workspace.reviewAlignment,
    rotationDegrees: selectedPhoto?.adjustment.rotationDegrees ?? 0,
    setReviewAlignment: workspace.setReviewAlignment,
  })
  const lateralityConflicts = findLateralityConflicts(workspace.photos)
  // 수동 배치 감시: 자동 거부권과 같은 실측 게이트로 뷰-각도 불일치를 경고한다.
  const pitchMedian = measuredPitchMedian(workspace.photos.map((photo) => photo.pose))
  const poseMismatches = new Map<ViewId, PoseMismatch>()
  for (const photo of workspace.photos) {
    const mismatch = detectViewPoseMismatch(photo.view, photo.pose, pitchMedian)
    if (mismatch !== null) {
      poseMismatches.set(photo.view, mismatch)
    }
  }
  const poseMismatchViews = [...poseMismatches.keys()]
  const selectedPoseMismatch =
    selectedPhoto === undefined ? null : (poseMismatches.get(selectedPhoto.view) ?? null)
  const suggestedView =
    selectedPhoto === undefined || selectedPoseMismatch === null
      ? null
      : suggestViewForPose(selectedPhoto.pose, pitchMedian)
  const selectedDiagnostics =
    selectedPhoto === undefined
      ? []
      : reviewDiagnostics(selectedPhoto.view, selectedPhoto.pose).filter(
          (diagnostic) =>
            !workspace.dismissedDiagnosticKeys.includes(`${selectedPhoto.view}:${diagnostic.kind}`),
        )
  const queue = buildWorkspaceReviewQueue(workspace.viewSet, {
    dismissedDiagnosticKeys: workspace.dismissedDiagnosticKeys,
    failures: workspace.failures,
    lateralityConflictViews: lateralityConflicts.map(({ view }) => view),
    mixupViews: workspace.mixupOffenderViews,
    photos: workspace.photos,
    poseMismatchViews,
  })
  const count = queue.length
  const firstTarget = queue[0]?.view ?? null
  const nextTarget = nextReviewView(queue, workspace.selectedView)
  const previousTarget = previousReviewView(queue, workspace.selectedView)
  const openInspector = useCallback((reason: "manual" | "review", trigger?: HTMLElement) => {
    inspectorTriggerRef.current =
      trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setInspectorOpenReason(reason)
  }, [])
  const closeInspector = useCallback(() => {
    setInspectorOpenReason(null)
    requestAnimationFrame(() => inspectorTriggerRef.current?.focus())
  }, [])
  const selectManually = useCallback(
    (view: ViewId) => {
      workspace.setSelectedView(view)
      openInspector("manual")
    },
    [openInspector, workspace.setSelectedView],
  )
  const startReview = useCallback(() => {
    if (firstTarget !== null) {
      workspace.setSelectedView(firstTarget)
      openInspector("review")
    }
  }, [firstTarget, openInspector, workspace.setSelectedView])

  useEffect(() => {
    if (inspectorOpenReason === "review" && count === 0) {
      closeInspector()
    }
  }, [closeInspector, inspectorOpenReason, count])

  return {
    closeInspector,
    count,
    firstTarget,
    inspectorOpenReason,
    lateralityConflicts,
    nextTarget,
    openInspector,
    pitchMedian,
    poseMismatchViews,
    previousTarget,
    queue,
    selectedDiagnostics,
    selectedFailure,
    selectedPhoto,
    selectedPoseMismatch,
    selectManually,
    startReview,
    suggestedView,
  }
}

export type WorkspaceReview = ReturnType<typeof useWorkspaceReview>
