import { ImageSquare, SpinnerGap, UploadSimple } from "@phosphor-icons/react"
import { type ChangeEvent, type DragEvent, useId } from "react"

export type DropZoneState = "empty" | "dragOver" | "validating" | "partial" | "invalid"

type DropZoneProps = {
  readonly disabled?: boolean
  readonly onFiles: (files: readonly File[]) => void
  readonly state: DropZoneState
}

const STATE_COPY = {
  empty: "사진 7장을 놓아주세요",
  dragOver: "여기에 놓으면 로컬에서만 읽습니다",
  validating: "파일을 확인하고 있습니다",
  partial: "나머지 사진을 추가해 주세요",
  invalid: "지원되는 사진인지 확인해 주세요",
} as const satisfies Record<DropZoneState, string>

function handleDragOver(event: DragEvent<HTMLLabelElement>): void {
  event.preventDefault()
}

export function DropZone({ disabled = false, onFiles, state }: DropZoneProps) {
  const detailId = useId()
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(event.currentTarget.files ?? []))
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    if (!disabled) {
      onFiles(Array.from(event.dataTransfer.files))
    }
  }

  return (
    <fieldset
      aria-busy={state === "validating"}
      aria-describedby={detailId}
      className="drop-zone-field"
      disabled={disabled}
    >
      <legend className="sr-only">사진 파일 입력</legend>
      <label
        className={`drop-zone drop-zone--${state}${disabled ? " drop-zone--disabled" : ""}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          accept="image/jpeg,image/png,image/webp"
          aria-label="사진 파일 선택"
          disabled={disabled}
          multiple
          onChange={handleChange}
          type="file"
        />
        <span className="drop-zone__icon" aria-hidden="true">
          {state === "empty" ? <UploadSimple size={28} /> : null}
          {state === "validating" ? <SpinnerGap className="drop-zone__spinner" size={28} /> : null}
          {state !== "empty" && state !== "validating" ? <ImageSquare size={28} /> : null}
        </span>
        <strong role="status">{STATE_COPY[state]}</strong>
        <span id={detailId}>
          JPG, PNG, WebP · 1~12장 · 파일당 최대 50MB ·{" "}
          <span className="drop-zone__privacy-copy">서버 업로드 없음</span>
        </span>
      </label>
    </fieldset>
  )
}
