import { useEffect, useRef } from "react"

import { Button } from "../ui/button"

type ModeChangeConfirmationProps = {
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

export function ModeChangeConfirmation({ onCancel, onConfirm }: ModeChangeConfirmationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) {
      return
    }
    if (typeof dialog.showModal === "function") {
      dialog.showModal()
    } else {
      dialog.setAttribute("open", "")
    }
    cancelRef.current?.focus()
  }, [])

  return (
    <dialog
      aria-labelledby="mode-change-title"
      className="mode-change-confirmation"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      ref={dialogRef}
    >
      <h2 id="mode-change-title">현재 결과를 버리고 작업 유형을 변경할까요?</h2>
      <p>현재 사진과 조정 내용은 복구할 수 없습니다.</p>
      <div className="mode-change-confirmation__actions">
        <Button onClick={onCancel} ref={cancelRef}>
          취소
        </Button>
        <Button onClick={onConfirm} variant="destructive">
          변경
        </Button>
      </div>
    </dialog>
  )
}
