import { useId } from "react"
import type { ViewId } from "../domain/types"
import { VIEW_LABELS } from "../domain/workspace"
import { Button } from "../ui/button"
import type { ReviewQueueItem } from "./review-queue"
import type { useWorkspace } from "./use-workspace"
import {
  buildWorkspaceSetOverview,
  type SetViewStatus,
  type WorkspaceSetOverviewSource,
} from "./workspace-set-overview-model"

type WorkspaceSetOverviewProps = {
  readonly workspace: WorkspaceSetOverviewSource &
    Pick<
      ReturnType<typeof useWorkspace>,
      "sessionName" | "setSessionName" | "selectedView" | "exporting" | "newSetAnalyzing"
    >
  readonly reviewQueue: readonly ReviewQueueItem[]
  readonly onSelect: (view: ViewId) => void
}

const STATUS_LABELS = {
  empty: "사진 없음",
  failure: "분석 실패",
  review: "확인 필요",
  placed: "배치됨",
} as const satisfies Record<SetViewStatus, string>

export function WorkspaceSetOverview({
  workspace,
  reviewQueue,
  onSelect,
}: WorkspaceSetOverviewProps) {
  const headingId = useId()
  const { captureDates, counts, views } = buildWorkspaceSetOverview(workspace, reviewQueue)
  const busy = workspace.exporting || workspace.newSetAnalyzing
  const unknownDates = captureDates.totalCount - captureDates.knownCount

  return (
    <section aria-labelledby={headingId} className="workspace-set-overview">
      <header className="workspace-set-overview__header">
        <div className="workspace-set-overview__identity">
          <h2 id={headingId}>촬영 세트 현황</h2>
          <strong className="workspace-set-overview__name">
            {workspace.sessionName || "이름 없는 세트"}
          </strong>
          <span className="workspace-set-overview__protocol">{workspace.viewSet.shortLabel}</span>
        </div>
        <details className="workspace-set-overview__edit">
          <summary>세트 정보 수정</summary>
          <label>
            <span>작업 세트명</span>
            <input
              aria-label="작업 세트명"
              autoComplete="off"
              disabled={busy}
              onChange={(event) => workspace.setSessionName(event.currentTarget.value)}
              value={workspace.sessionName}
            />
          </label>
          <small>현재 작업과 내보내기에 함께 사용합니다.</small>
        </details>
      </header>

      <p className="workspace-set-overview__dates">
        {captureDates.knownCount === 0 ? (
          <span>촬영일 미확인 · EXIF 정보 없음</span>
        ) : (
          <>
            <span>촬영일 (EXIF)</span>
            <span>{captureDates.days.join(" · ")}</span>
            {captureDates.days.length > 1 ? <span>여러 날짜</span> : null}
            {unknownDates > 0 ? <span>{unknownDates}장 촬영일 미확인</span> : null}
          </>
        )}
      </p>

      <p className="workspace-set-overview__counts">
        <span>
          배치 사진{" "}
          <strong>
            {counts.included} / {views.length}
          </strong>
        </span>
        <span>
          사진 없는 뷰 <strong>{counts.missing}</strong>
        </span>
        <span>
          검토할 뷰 <strong>{counts.review}</strong>
        </span>
        {counts.failed > 0 ? (
          <span>
            분석 실패 뷰 <strong>{counts.failed}</strong>
          </span>
        ) : null}
      </p>

      <fieldset aria-label="세트별 뷰 상태" className="workspace-set-overview__views">
        {views.map(({ status, view }) => (
          <Button
            aria-controls="workspace-inspector"
            aria-label={`${VIEW_LABELS[view]} · ${STATUS_LABELS[status]}`}
            aria-pressed={workspace.selectedView === view}
            className={`workspace-set-overview__view workspace-set-overview__view--${status}`}
            disabled={busy}
            key={view}
            onClick={() => onSelect(view)}
          >
            <span>{VIEW_LABELS[view]}</span>
            <span className="workspace-set-overview__status">{STATUS_LABELS[status]}</span>
          </Button>
        ))}
      </fieldset>
      <p className="workspace-set-overview__excluded">
        출력 미포함 · 예비 {counts.spares}장 · 미배치 실패 {counts.trayFailures}장
      </p>
    </section>
  )
}
