import { ArrowClockwise, ImageSquare, Wrench } from "@phosphor-icons/react"
import type { ChangeEvent } from "react"

import { VIEW_LABELS } from "../domain/workspace"
import { Button } from "../ui/button"
import { analysisFailureCopy } from "./analysis-failure-copy"
import type { FailedWorkspacePhoto } from "./use-workspace"

type FailureRecoveryPanelProps = {
  readonly failure: FailedWorkspacePhoto
  readonly onAssignManually: () => void
  readonly onReplace: (file: File) => void
  readonly onRetry: () => void
}

export function FailureRecoveryPanel({
  failure,
  onAssignManually,
  onReplace,
  onRetry,
}: FailureRecoveryPanelProps) {
  const handleReplacement = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (file !== undefined) {
      onReplace(file)
    }
    event.currentTarget.value = ""
  }

  return (
    <aside className="inspector-panel recovery-panel" aria-labelledby="recovery-title">
      <div className="panel-heading">
        <span>복구가 필요한 뷰</span>
        <strong id="recovery-title">{VIEW_LABELS[failure.view]}</strong>
      </div>
      <div className="recovery-panel__icon" aria-hidden="true">
        <ImageSquare size={32} />
      </div>
      <p className="recovery-panel__error">{analysisFailureCopy(failure.code)}</p>
      <p className="recovery-panel__file">{failure.fileName}</p>
      <div className="recovery-panel__actions">
        <label className="button button--secondary">
          <ImageSquare aria-hidden="true" size={18} /> 사진 교체
          <input
            accept="image/jpeg,image/png,image/webp"
            aria-label={`${VIEW_LABELS[failure.view]} 사진 교체`}
            onChange={handleReplacement}
            type="file"
          />
        </label>
        <Button onClick={onRetry} variant="quiet">
          <ArrowClockwise aria-hidden="true" size={18} /> 같은 사진 다시 분석
        </Button>
        {failure.decoded === null ? null : (
          <Button onClick={onAssignManually} variant="secondary">
            <Wrench aria-hidden="true" size={18} /> 중앙 크롭으로 수동 지정
          </Button>
        )}
      </div>
      <p className="inspector-panel__note">
        실패한 사진만 교체·재시도할 수 있습니다. 나머지 뷰의 보정값은 변경하지 않습니다.
      </p>
    </aside>
  )
}
