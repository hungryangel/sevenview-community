import { type DragEvent, useEffect, useRef, useState } from "react"
import { isDetectionWeak } from "../domain/detection-quality"
import { joinGwaWa } from "../domain/josa"
import type { FramingPreset } from "../domain/protocol-preset"
import type { ViewId } from "../domain/types"
import { suggestViewForPose } from "../domain/view-plausibility"
import type { LateralityConflict, WorkspacePhoto } from "../domain/workspace"
import { DEFAULT_CROP_ADJUSTMENT, hasCropAdjustment, VIEW_LABELS } from "../domain/workspace"
import { ViewSlot } from "../ui/view-slot"
import { analysisFailureCopy } from "./analysis-failure-copy"
import { CropPreview } from "./crop-preview"
import type { FailedWorkspacePhoto, SpareWorkspacePhoto, TrayFailure } from "./use-workspace"

type SequenceRailProps = {
  readonly failures: readonly FailedWorkspacePhoto[]
  readonly framing: FramingPreset
  readonly lateralityConflicts: readonly LateralityConflict[]
  readonly mismatchViews: readonly ViewId[]
  readonly mixupViews: readonly ViewId[]
  readonly onMove: (view: ViewId, direction: -1 | 1) => void
  readonly onReorder: (sourceView: ViewId, targetView: ViewId) => void
  readonly onRetryTrayFailure: (fileName: string) => void
  readonly onSelect: (view: ViewId) => void
  readonly inspectorOpen?: boolean
  readonly onSwapSpare: (sparePhotoId: string, targetView: ViewId) => void
  readonly photos: readonly WorkspacePhoto<CanvasImageSource>[]
  readonly pitchMedian: number
  readonly sequenceOrder: readonly ViewId[]
  readonly selectedView: ViewId
  readonly spares: readonly SpareWorkspacePhoto[]
  readonly trayFailures: readonly TrayFailure[]
}

export function SequenceRail({
  failures,
  framing,
  lateralityConflicts,
  mismatchViews,
  mixupViews,
  onMove,
  onReorder,
  onRetryTrayFailure,
  onSelect,
  inspectorOpen = false,
  onSwapSpare,
  photos,
  pitchMedian,
  sequenceOrder,
  selectedView,
  spares,
  trayFailures,
}: SequenceRailProps) {
  const [draggingView, setDraggingView] = useState<ViewId | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>(".view-slot") ?? []
    for (const button of buttons) {
      button.setAttribute("aria-controls", "workspace-inspector")
      button.setAttribute(
        "aria-expanded",
        String(inspectorOpen && button.getAttribute("aria-current") === "true"),
      )
    }
  })
  const handleDrop = (event: DragEvent<HTMLLIElement>, targetView: ViewId) => {
    event.preventDefault()
    if (draggingView !== null) {
      onReorder(draggingView, targetView)
    }
    setDraggingView(null)
  }

  return (
    <aside className="sequence-rail" aria-labelledby="sequence-title">
      <div className="panel-heading">
        <span>시퀀스</span>
        <strong id="sequence-title">
          {photos.length} / {sequenceOrder.length}
        </strong>
      </div>
      <p className="sequence-rail__reorder-hint">드래그로 순서 변경</p>
      <p className="sequence-rail__laterality">좌우 표기: 환자 기준</p>
      <ol className="sequence-rail__list" ref={listRef}>
        {sequenceOrder.map((view, index) => {
          const photo = photos.find((candidate) => candidate.view === view)
          const failure = failures.find((candidate) => candidate.view === view)
          const lateralityConflict = lateralityConflicts.some((conflict) => conflict.view === view)
          const mixupSuspect = mixupViews.includes(view)
          const poseMismatch = mismatchViews.includes(view)
          const weakDetection =
            photo !== undefined && isDetectionWeak(photo.view, photo.pose.confidence)
          const state =
            failure !== undefined
              ? "error"
              : photo === undefined
                ? "empty"
                : lateralityConflict || mixupSuspect || poseMismatch || weakDetection
                  ? "warning"
                  : "ready"
          return (
            <li
              draggable
              key={view}
              onDragEnd={() => setDraggingView(null)}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move"
                setDraggingView(view)
              }}
              onDrop={(event) => handleDrop(event, view)}
            >
              <ViewSlot
                adjusted={photo !== undefined && hasCropAdjustment(photo.adjustment)}
                assignmentMethod={photo?.assignmentMethod}
                index={index + 1}
                label={VIEW_LABELS[view]}
                onMoveEarlier={index > 0 ? () => onMove(view, -1) : undefined}
                onMoveLater={index < sequenceOrder.length - 1 ? () => onMove(view, 1) : undefined}
                onSelect={() => onSelect(view)}
                preview={
                  photo === undefined ? undefined : <CropPreview framing={framing} photo={photo} />
                }
                selected={view === selectedView}
                sourcePhotoId={photo?.pose.id}
                state={state}
                statusText={
                  failure !== undefined
                    ? analysisFailureCopy(failure.code)
                    : photo === undefined
                      ? "미촬영"
                      : lateralityConflict
                        ? "좌우 확인"
                        : mixupSuspect
                          ? "혼입 확인"
                          : poseMismatch
                            ? "각도 불일치"
                            : weakDetection
                              ? "기준점 흐림"
                              : undefined
                }
                variant="rail"
              />
            </li>
          )
        })}
      </ol>
      {spares.length === 0 && trayFailures.length === 0 ? null : (
        <div className="sequence-rail__tray">
          <p className="sequence-rail__tray-title">
            예비 {spares.length}장
            {trayFailures.length > 0 ? ` · 분석 실패 ${trayFailures.length}장` : ""}
          </p>
          <ul className="sequence-rail__tray-list">
            {spares.map((spare) => {
              // 예비 사진의 측정 각도 — 배치 규칙과 같은 자로 "어느 뷰로 보이는지"를
              // 말한다(2026-09-02 bee 지적: 선택 뷰 이름만 붙은 버튼이 추천처럼 읽혔다).
              const measuredView =
                spare.pose.eyeCenter === undefined
                  ? null
                  : suggestViewForPose(spare.pose, pitchMedian)
              const primaryTarget = measuredView ?? selectedView
              const swapLabel = (view: ViewId) =>
                photos.some((photo) => photo.view === view)
                  ? `${joinGwaWa(VIEW_LABELS[view])} 교체`
                  : `${VIEW_LABELS[view]}에 배치`
              const blocked = (view: ViewId) => failures.some((failure) => failure.view === view)
              return (
                <li key={spare.pose.id}>
                  <span className="sequence-rail__tray-preview">
                    <CropPreview
                      framing={framing}
                      photo={{
                        ...spare,
                        adjustment: DEFAULT_CROP_ADJUSTMENT,
                        assignmentMethod: "auto",
                        view: measuredView ?? "front",
                      }}
                    />
                  </span>
                  <div className="sequence-rail__tray-body">
                    <small className="sequence-rail__tray-measure">
                      {measuredView === null ? "측정값 없음" : `측정: ${VIEW_LABELS[measuredView]}`}
                    </small>
                    <button
                      disabled={blocked(primaryTarget)}
                      onClick={() => onSwapSpare(spare.pose.id, primaryTarget)}
                      type="button"
                    >
                      {swapLabel(primaryTarget)}
                    </button>
                    {measuredView === null || measuredView === selectedView ? null : (
                      <button
                        className="sequence-rail__tray-secondary"
                        disabled={blocked(selectedView)}
                        onClick={() => onSwapSpare(spare.pose.id, selectedView)}
                        type="button"
                      >
                        선택한 {swapLabel(selectedView)}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
            {trayFailures.map((trayFailure) => (
              <li key={trayFailure.fileName}>
                <span className="sequence-rail__tray-preview sequence-rail__tray-preview--failed">
                  실패
                </span>
                <button onClick={() => onRetryTrayFailure(trayFailure.fileName)} type="button">
                  다시 분석
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}
