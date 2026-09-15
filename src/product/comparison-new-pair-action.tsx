import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "../ui/button"
import { useDismissable } from "../ui/use-dismissable"

type ComparisonNewPairActionProps = {
  readonly active: boolean
  readonly disabled: boolean
  readonly exported: boolean
  readonly onStartNew: () => void
}

export function ComparisonNewPairAction({
  active,
  disabled,
  exported,
  onStartNew,
}: ComparisonNewPairActionProps) {
  const [confirming, setConfirming] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const closeAndRestore = useCallback(() => {
    setConfirming(false)
    triggerRef.current?.focus()
  }, [])
  const dismiss = useCallback((reason: "escape" | "pointer") => {
    setConfirming(false)
    if (reason === "escape") triggerRef.current?.focus()
  }, [])
  useDismissable(active && confirming, dismiss, containerRef)
  useEffect(() => {
    if (active && confirming) cancelRef.current?.focus()
    if (!active || disabled) setConfirming(false)
  }, [active, confirming, disabled])

  const begin = () => {
    if (exported) {
      onStartNew()
    } else {
      setConfirming(true)
    }
  }

  return (
    <div className="comparison-new-pair" ref={containerRef}>
      <Button disabled={disabled} onClick={begin} ref={triggerRef} variant="secondary">
        새 비교 시작
      </Button>
      {confirming ? (
        <div
          aria-label="저장하지 않은 비교 지우기"
          className="comparison-new-pair__confirmation"
          role="alertdialog"
        >
          <p>아직 저장하지 않은 비교입니다. 현재 사진과 조정을 지울까요?</p>
          <div>
            <Button
              disabled={disabled}
              onClick={closeAndRestore}
              ref={cancelRef}
              variant="secondary"
            >
              계속 작업
            </Button>
            <Button disabled={disabled} onClick={onStartNew} variant="destructive">
              저장하지 않고 새 비교 시작
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
