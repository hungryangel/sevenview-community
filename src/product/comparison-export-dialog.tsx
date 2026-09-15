import { DownloadSimple, X } from "@phosphor-icons/react"
import { useEffect, useId, useRef } from "react"
import {
  buildComparisonExportFilename,
  type ComparisonExportSettings,
  hasComparisonExportOutput,
} from "../domain/comparison-export"
import { Button } from "../ui/button"

const COMPARISON_OUTPUTS = [
  { key: "png", label: "비교 PNG", description: "두 사진 · 1600 × 1000" },
  { key: "individualPngs", label: "개별 PNG", description: "두 파일 · 각 752 × 940" },
  { key: "pdf", label: "비교 PDF", description: "한 페이지" },
  { key: "pptx", label: "비교 PPTX", description: "사진·문구 개별 편집" },
  { key: "html", label: "설명용 HTML", description: "오프라인 슬라이더 · VELNOC 로고" },
] as const

export type ComparisonExportDialogProps = {
  readonly open: boolean
  readonly settings: ComparisonExportSettings
  readonly busy: boolean
  readonly message: string | null
  readonly onChange: (settings: ComparisonExportSettings) => void
  readonly onClose: () => void
  readonly onExport: () => void
}

export function ComparisonExportDialog({
  open,
  settings,
  busy,
  message,
  onChange,
  onClose,
  onExport,
}: ComparisonExportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || dialog === null) return undefined
    const opener = document.activeElement
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal()
      else dialog.setAttribute("open", "")
    }
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [open])

  if (!open) return null

  const closeDialog = () => {
    if (busy) return
    const dialog = dialogRef.current
    if (dialog !== null && typeof dialog.close === "function" && dialog.open) {
      dialog.close()
    } else onClose()
  }
  const hasOutput = hasComparisonExportOutput(settings.selection)

  return (
    <dialog
      aria-labelledby={titleId}
      className="export-dialog comparison-export-dialog"
      onCancel={(event) => {
        event.preventDefault()
        closeDialog()
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <header className="export-dialog__header">
        <h2 id={titleId}>비교 저장 옵션</h2>
        <button
          aria-label="비교 저장 옵션 닫기"
          disabled={busy}
          onClick={closeDialog}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </header>
      <div className="export-bar__session export-dialog__session">
        <label>
          <span>세션명</span>
          <input
            aria-label="세션명"
            disabled={busy}
            onChange={(event) => onChange({ ...settings, sessionName: event.currentTarget.value })}
            value={settings.sessionName}
          />
        </label>
      </div>
      <fieldset className="export-dialog__outputs" disabled={busy}>
        <legend>출력</legend>
        {COMPARISON_OUTPUTS.map(({ key, label, description }) => (
          <label key={key}>
            <input
              aria-label={label}
              checked={settings.selection[key]}
              onChange={(event) =>
                onChange({
                  ...settings,
                  selection: { ...settings.selection, [key]: event.currentTarget.checked },
                })
              }
              type="checkbox"
            />
            {label} <small>{description}</small>
          </label>
        ))}
      </fieldset>
      <div className="export-dialog__file">
        <small>저장될 파일</small>
        <strong className="export-dialog__filename">
          {hasOutput ? buildComparisonExportFilename(settings) : "출력을 하나 이상 선택하세요"}
        </strong>
        <small>
          파일이 둘 이상이면 ZIP 한 파일로 내려받습니다. 세션명은 파일명에만 포함됩니다.
        </small>
        {settings.selection.html ? <small>HTML 파일에는 두 사진이 포함됩니다.</small> : null}
        <small aria-live="polite" role="status">
          {message ?? (busy ? "비교 파일을 준비하고 있습니다." : "")}
        </small>
      </div>
      <footer className="export-dialog__actions">
        <Button disabled={busy} onClick={closeDialog} variant="quiet">
          취소
        </Button>
        <Button disabled={!hasOutput || busy} loading={busy} onClick={onExport} variant="primary">
          <DownloadSimple aria-hidden="true" size={19} /> 비교 파일 저장
        </Button>
      </footer>
    </dialog>
  )
}
