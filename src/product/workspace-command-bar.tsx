import { ArrowsClockwise, Info } from "@phosphor-icons/react"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"

import { Button } from "../ui/button"
import { type PrivacyState, PrivacyStatus } from "../ui/privacy-status"
import { type DismissReason, useDismissable } from "../ui/use-dismissable"
import type { Activity } from "./activity-status"
import { WorkspaceHeaderAction } from "./workspace-header-action"

type WorkspaceCommandBarProps = {
  readonly activity: Activity
  readonly active?: boolean
  readonly disabled?: boolean
  readonly actionSlot?: ReactNode
  readonly embedded?: boolean
  readonly navigation?: ReactNode
  readonly onOpenGuide: () => void
  readonly onNewSet: () => void
  readonly privacyState: PrivacyState
  readonly resetNeedsConfirmation: boolean
  readonly showReset: boolean
}

export function WorkspaceCommandBar({
  activity,
  active = true,
  disabled = false,
  actionSlot,
  embedded = false,
  navigation,
  onOpenGuide,
  onNewSet,
  privacyState,
  resetNeedsConfirmation,
  showReset,
}: WorkspaceCommandBarProps) {
  const [confirmingReset, setConfirmingReset] = useState(false)
  const resetRef = useRef<HTMLDivElement>(null)
  const resetTriggerRef = useRef<HTMLButtonElement>(null)
  const dismissResetConfirmation = useCallback((reason: DismissReason) => {
    setConfirmingReset(false)
    if (reason === "escape") {
      resetTriggerRef.current?.focus()
    }
  }, [])
  useDismissable(active && confirmingReset, dismissResetConfirmation, resetRef)
  useEffect(() => {
    if (!active) setConfirmingReset(false)
  }, [active])

  const handleResetClick = () => {
    if (!resetNeedsConfirmation) {
      onNewSet()
      return
    }
    setConfirmingReset((open) => !open)
  }

  const actions = (
    <div className="workspace-command-bar__actions">
      {embedded ? null : (
        <Button onClick={onOpenGuide} variant="quiet">
          <Info aria-hidden="true" size={18} /> 가이드
        </Button>
      )}
      {embedded ? null : <PrivacyStatus activity={activity} state={privacyState} />}
      {showReset ? (
        <div className="workspace-command-bar__reset" ref={resetRef}>
          <Button
            disabled={disabled}
            aria-expanded={resetNeedsConfirmation ? confirmingReset : undefined}
            onClick={handleResetClick}
            ref={resetTriggerRef}
            variant="secondary"
          >
            <ArrowsClockwise aria-hidden="true" size={18} /> 새로 시작
          </Button>
          {confirmingReset ? (
            <div className="workspace-command-bar__reset-confirm">
              <strong>아직 내보내지 않았습니다</strong>
              <p>새 세트 정렬이 끝나면 지금 세트의 정렬·보정이 사라집니다.</p>
              <div>
                <Button onClick={() => setConfirmingReset(false)} variant="quiet">
                  계속 작업
                </Button>
                <Button
                  disabled={disabled}
                  onClick={() => {
                    setConfirmingReset(false)
                    onNewSet()
                  }}
                  variant="destructive"
                >
                  새 세트 시작
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {actionSlot}
    </div>
  )

  if (embedded) {
    if (!showReset) return null
    return <WorkspaceHeaderAction active={active}>{actions}</WorkspaceHeaderAction>
  }

  return (
    <header className="workspace-command-bar">
      <a className="workspace-brand" href={import.meta.env.BASE_URL} aria-label="SevenView 홈">
        <span aria-hidden="true" className="workspace-brand__mark">
          7
        </span>
        <span>
          <strong>SevenView</strong>
          <small>임상 사진 워크스페이스</small>
        </span>
      </a>
      {navigation}
      {actions}
    </header>
  )
}
