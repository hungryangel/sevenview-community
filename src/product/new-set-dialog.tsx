import { X } from "@phosphor-icons/react"
import { useEffect, useRef } from "react"

import { Button } from "../ui/button"
import type { WorkspaceMessage } from "./use-workspace"

type NewSetDialogProps = {
  readonly analyzing: boolean
  readonly message: WorkspaceMessage | null
  readonly onAppendFiles: (files: readonly File[]) => void
  readonly onClose: () => void
  readonly onRemoveFile: (index: number) => void
  readonly onStart: () => void
  readonly open: boolean
  readonly pendingFiles: readonly { readonly name: string; readonly previewUrl: string }[]
  readonly progress: number
}

// 툴 화면 위의 '새 세트' 팝업(2026-09-02 bee): 랜딩으로 돌아가지 않고, 지금 세트를 뒤에
// 그대로 둔 채 새 사진을 받는다. 정렬이 끝나면 새 세트가 지금 세트를 교체한다.
export function NewSetDialog({
  analyzing,
  message,
  onAppendFiles,
  onClose,
  onRemoveFile,
  onStart,
  open,
  pendingFiles,
  progress,
}: NewSetDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }
    const dialog = dialogRef.current
    if (dialog === null) {
      return undefined
    }
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal()
      } else {
        dialog.setAttribute("open", "")
      }
    }
    const handleClose = () => onClose()
    dialog.addEventListener("close", handleClose)
    return () => dialog.removeEventListener("close", handleClose)
  }, [open, onClose])

  if (!open) {
    return null
  }

  const closeDialog = () => {
    if (analyzing) {
      return
    }
    const dialog = dialogRef.current
    if (dialog !== null && typeof dialog.close === "function" && dialog.open) {
      dialog.close()
      return
    }
    onClose()
  }

  return (
    <dialog
      aria-labelledby="new-set-title"
      className="new-set"
      onCancel={(event) => {
        if (analyzing) {
          event.preventDefault()
        }
      }}
      ref={dialogRef}
    >
      <header className="new-set__header">
        <h2 id="new-set-title">새 세트 시작</h2>
        <button aria-label="새 세트 닫기" disabled={analyzing} onClick={closeDialog} type="button">
          <X aria-hidden="true" size={18} />
        </button>
      </header>
      <p className="new-set__lead">
        지금 세트는 새 세트 정렬이 끝날 때까지 그대로 남고, 끝나면 교체됩니다. 사진은 이 브라우저
        밖으로 나가지 않습니다.
      </p>
      <label className={`new-set__drop${analyzing ? " new-set__drop--busy" : ""}`}>
        <span>사진을 여기로 끌어다 놓거나 눌러서 선택하세요</span>
        <small>JPG, PNG, WebP · 1~12장</small>
        <input
          accept="image/jpeg,image/png,image/webp"
          aria-label="새 세트 사진 선택"
          disabled={analyzing}
          multiple
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? [])
            event.currentTarget.value = ""
            onAppendFiles(files)
          }}
          type="file"
        />
      </label>
      {pendingFiles.length === 0 ? null : (
        <ul aria-label="새 세트 사진" className="new-set__files">
          {pendingFiles.map((pendingFile, index) => (
            <li key={pendingFile.previewUrl}>
              <img alt="" src={pendingFile.previewUrl} />
              <span>{index + 1}</span>
              <button
                aria-label={`${index + 1}번 사진 빼기`}
                disabled={analyzing}
                onClick={() => onRemoveFile(index)}
                type="button"
              >
                <X aria-hidden="true" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {message === null ? null : (
        <p className={`new-set__message new-set__message--${message.kind}`} role="alert">
          <strong>{message.title}</strong> {message.text}
        </p>
      )}
      <footer className="new-set__actions">
        <span aria-live="polite">
          {analyzing
            ? `분석 중 ${Math.round(progress)}%`
            : pendingFiles.length === 0
              ? "사진을 추가하면 정렬을 시작할 수 있습니다."
              : `${pendingFiles.length}장 선택됨`}
        </span>
        <div>
          <Button disabled={analyzing} onClick={closeDialog} variant="quiet">
            취소
          </Button>
          <Button
            className="button--glow"
            disabled={pendingFiles.length === 0 || analyzing}
            loading={analyzing}
            onClick={onStart}
            variant="primary"
          >
            AI 자동 정렬
          </Button>
        </div>
      </footer>
    </dialog>
  )
}
