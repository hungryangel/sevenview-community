import { useEffect, useId, useRef, useState } from "react"
import { COMPARISON_ANGLES, type ComparisonAngle } from "../domain/comparison"
import type { ComparisonReferencePair } from "../domain/comparison-reference-pair"
import { Button } from "../ui/button"
import type { ComparisonEditablePair } from "./comparison-editable-pair"
import { ComparisonPairedReferenceEditor } from "./comparison-paired-reference-editor"
import type { ManualComparisonReferences } from "./comparison-render-model"
import { ANGLE_LABELS } from "./comparison-viewer"

type Props = {
  readonly pair: ComparisonEditablePair
  readonly angle: ComparisonAngle | null
  readonly initialReferences: ManualComparisonReferences
  readonly active: boolean
  readonly disabled: boolean
  readonly onApply: (references: ComparisonReferencePair, angle: ComparisonAngle) => boolean
  readonly onClose: () => void
}

export function ComparisonAlignmentDialog(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [angle, setAngle] = useState(props.angle)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    if (dialog !== null && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal()
      else dialog.setAttribute("open", "")
    }
    return () => {
      if (dialog?.open && typeof dialog.close === "function") dialog.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])
  return (
    <dialog
      aria-labelledby={titleId}
      className="comparison-alignment-dialog"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault()
        props.onClose()
      }}
    >
      <header className="comparison-alignment-dialog__header">
        <h2 id={titleId}>두 사진 기준점 맞추기</h2>
        <Button onClick={props.onClose} variant="quiet" aria-label="기준점 맞추기 닫기">
          닫기
        </Button>
      </header>
      {props.angle === null ? (
        <label className="comparison-alignment-dialog__direction">
          같은 촬영 방향인지 확인하세요
          <select
            value={angle ?? ""}
            onChange={(event) => {
              const next = COMPARISON_ANGLES.find((item) => item === event.currentTarget.value)
              setAngle(next ?? null)
            }}
          >
            <option value="">방향 선택</option>
            {COMPARISON_ANGLES.map((value) => (
              <option value={value} key={value}>
                {ANGLE_LABELS[value]}
              </option>
            ))}
          </select>
          <small>좌·우는 코가 화면에서 향하는 방향입니다. 사진을 회전시키는 설정이 아닙니다.</small>
        </label>
      ) : null}
      <p className="comparison-alignment-dialog__hint">
        이마·콧대 등 같은 부위를 고르세요. 변화를 관찰할 턱·목 윤곽은 피하세요.
      </p>
      <ComparisonPairedReferenceEditor
        key={angle ?? "unconfirmed"}
        pair={props.pair}
        angle={angle ?? "front"}
        initialReferences={props.initialReferences}
        active={props.active}
        disabled={props.disabled || angle === null}
        onCancel={props.onClose}
        onApply={(references) => {
          if (angle === null || !props.active || props.disabled) return
          if (props.onApply(references, angle)) props.onClose()
          else setMessage("사진이 변경되어 적용하지 못했습니다. 닫은 뒤 다시 시작해 주세요.")
        }}
      />
      {message === null ? null : <p role="status">{message}</p>}
    </dialog>
  )
}
