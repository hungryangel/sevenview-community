import { DownloadSimple, X } from "@phosphor-icons/react"
import { useEffect, useRef } from "react"

import {
  buildContactSheetFilename,
  buildContactSheetPdfFilename,
  buildContactSheetPptxFilename,
  buildExportBundleFilename,
  countExportArtifacts,
  type ExportSelection,
  hasExportOutput,
} from "../domain/session-export"
import { Button } from "../ui/button"

type ExportDialogProps = {
  readonly exportSelection: ExportSelection
  readonly exporting: boolean
  readonly onClose: () => void
  readonly onExport: () => void
  readonly onExportSelectionChange: (selection: ExportSelection) => void
  readonly onPatientLabelChange: (patientLabel: string) => void
  readonly onSessionNameChange: (sessionName: string) => void
  readonly open: boolean
  readonly patientLabel: string
  readonly photoCount: number
  readonly sessionName: string
}

// 내보내기 대화상자(2026-09-03 bee): '설정 팝업 → 실행 버튼' 두 단계 대신, 내보내기를 누르면
// 세션명·환자 라벨·출력 선택·저장될 파일명을 한 화면에서 정하고 그 자리에서 저장한다.
export function ExportDialog({
  exportSelection,
  exporting,
  onClose,
  onExport,
  onExportSelectionChange,
  onPatientLabelChange,
  onSessionNameChange,
  open,
  patientLabel,
  photoCount,
  sessionName,
}: ExportDialogProps) {
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
    const dialog = dialogRef.current
    if (dialog !== null && typeof dialog.close === "function" && dialog.open) {
      dialog.close()
      return
    }
    onClose()
  }

  const nothingSelected = !hasExportOutput(exportSelection)
  const artifactCount = countExportArtifacts(exportSelection, photoCount)
  const previewFilename =
    artifactCount === 0
      ? null
      : artifactCount > 1
        ? buildExportBundleFilename({ patientLabel, sessionName })
        : exportSelection.contactSheet
          ? buildContactSheetFilename({ patientLabel, sessionName })
          : exportSelection.pdf
            ? buildContactSheetPdfFilename({ patientLabel, sessionName })
            : exportSelection.pptx
              ? buildContactSheetPptxFilename({ patientLabel, sessionName })
              : buildExportBundleFilename({ patientLabel, sessionName })

  return (
    <dialog aria-labelledby="export-title" className="export-dialog" ref={dialogRef}>
      <header className="export-dialog__header">
        <h2 id="export-title">내보내기</h2>
        <button aria-label="내보내기 닫기" onClick={closeDialog} type="button">
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      <div className="export-bar__session export-dialog__session">
        <label>
          <span>세션명</span>
          <input
            aria-label="세션명"
            onChange={(event) => onSessionNameChange(event.currentTarget.value)}
            value={sessionName}
          />
        </label>
        <label>
          <span>환자 라벨 (선택)</span>
          <input
            aria-label="환자 라벨 (선택)"
            onChange={(event) => onPatientLabelChange(event.currentTarget.value)}
            placeholder="파일명에만 포함"
            value={patientLabel}
          />
        </label>
        {patientLabel === "" ? null : (
          <small className="export-bar__privacy-warning">
            다운로드 폴더의 클라우드 동기화 여부를 확인하세요
          </small>
        )}
      </div>

      <fieldset className="export-dialog__outputs">
        <legend>출력</legend>
        <label>
          <input
            checked={exportSelection.contactSheet}
            onChange={(event) =>
              onExportSelectionChange({
                ...exportSelection,
                contactSheet: event.currentTarget.checked,
              })
            }
            type="checkbox"
          />
          컨택트 시트 PNG <small>2400 × 1600</small>
        </label>
        <label>
          <input
            checked={exportSelection.pdf}
            onChange={(event) =>
              onExportSelectionChange({ ...exportSelection, pdf: event.currentTarget.checked })
            }
            type="checkbox"
          />
          컨택트 시트 PDF <small>한 페이지</small>
        </label>
        <label>
          <input
            checked={exportSelection.pptx}
            onChange={(event) =>
              onExportSelectionChange({ ...exportSelection, pptx: event.currentTarget.checked })
            }
            type="checkbox"
          />
          컨택트 시트 PPT <small>슬라이드 한 장 · 사진·문구 개별 개체</small>
        </label>
        <label>
          <input
            checked={exportSelection.individualPngs}
            onChange={(event) =>
              onExportSelectionChange({
                ...exportSelection,
                individualPngs: event.currentTarget.checked,
              })
            }
            type="checkbox"
          />
          개별 {photoCount}장 PNG
        </label>
      </fieldset>

      <div className="export-dialog__file">
        <small>저장될 파일</small>
        <strong className="export-dialog__filename">
          {previewFilename ?? "출력을 하나 이상 선택하세요"}
        </strong>
        <small>
          모든 파일은 이 브라우저에서 새로 생성됩니다. 파일이 둘 이상이면 ZIP 한 파일로
          내려받습니다.
        </small>
      </div>

      <footer className="export-dialog__actions">
        <Button onClick={closeDialog} variant="quiet">
          취소
        </Button>
        <Button
          disabled={nothingSelected || exporting}
          loading={exporting}
          onClick={() => {
            onExport()
            closeDialog()
          }}
          variant="primary"
        >
          <DownloadSimple aria-hidden="true" size={19} /> 저장하기
        </Button>
      </footer>
    </dialog>
  )
}
