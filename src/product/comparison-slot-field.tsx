import { ArrowClockwise, Trash, UploadSimple } from "@phosphor-icons/react"
import { type ChangeEvent, useEffect, useLayoutEffect, useRef, useState } from "react"

import type { ComparisonSide } from "../domain/comparison"
import { type ComparisonSlot, isRenderableComparisonSlot } from "../domain/comparison-session"
import { type FileBoundaryError, parseImageFiles } from "../domain/files"
import { Button } from "../ui/button"
import { analysisFailureCopy } from "./analysis-failure-copy"

export const COMPARISON_SIDE_LABELS = {
  before: "시술 전 사진",
  after: "시술 후 사진",
} as const

function boundaryCopy(error?: FileBoundaryError): string {
  if (error?.code === "heic_unsupported") {
    return "HEIC·HEIF는 지원하지 않습니다. JPG, PNG 또는 WebP로 변환해 주세요."
  }
  if (error?.code === "raw_unsupported") {
    return "RAW는 지원하지 않습니다. JPG, PNG 또는 WebP로 변환해 주세요."
  }
  if (error?.code === "too_large") {
    return "사진 한 장은 50MB 이하여야 합니다."
  }
  return "JPG, PNG, WebP 사진 한 장만 선택해 주세요."
}

function ReadyPreview({
  slot,
  side,
}: {
  readonly side: ComparisonSide
  readonly slot: Extract<ComparisonSlot<CanvasImageSource>, { readonly kind: "ready" | "manual" }>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (canvas === null || context === null || context === undefined) {
      return
    }
    const scale = Math.min(1, 800 / slot.decoded.width, 1000 / slot.decoded.height)
    canvas.width = Math.round(slot.decoded.width * scale)
    canvas.height = Math.round(slot.decoded.height * scale)
    context.drawImage(slot.decoded.image, 0, 0, canvas.width, canvas.height)
  }, [slot])
  return (
    <canvas
      aria-label={`${COMPARISON_SIDE_LABELS[side]} 분석 미리보기`}
      ref={canvasRef}
      role="img"
    />
  )
}

export function ComparisonSlotField({
  disabled = false,
  focusSelect = false,
  onRemove,
  onRetry,
  onManual,
  onSelect,
  side,
  slot,
  showReadyPreview = true,
}: {
  readonly disabled?: boolean
  readonly focusSelect?: boolean
  readonly onRemove: () => void
  readonly onRetry: () => void
  readonly onManual?: () => void
  readonly onSelect: (file: File) => void
  readonly side: ComparisonSide
  readonly slot: ComparisonSlot<CanvasImageSource>
  readonly showReadyPreview?: boolean
}) {
  const localInputRef = useRef<HTMLInputElement>(null)
  const inputRef = localInputRef
  const sectionRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (focusSelect) {
      sectionRef.current
        ?.querySelector<HTMLButtonElement>(".comparison-slot__actions button")
        ?.focus()
    }
  }, [focusSelect])
  const [validationError, setValidationError] = useState<string | null>(null)
  const handleFiles = (files: readonly File[]) => {
    if (disabled) return
    const parsed = parseImageFiles(files)
    if (files.length !== 1) {
      setValidationError(boundaryCopy())
      return
    }
    if (parsed.kind === "rejected") {
      setValidationError(boundaryCopy(parsed.error))
      return
    }
    setValidationError(null)
    const file = parsed.files[0]
    if (file !== undefined) {
      onSelect(file)
    }
  }
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(event.target.files ?? []))
    event.target.value = ""
  }
  const selected = slot.kind !== "empty"

  return (
    <section
      aria-labelledby={`comparison-${side}-title`}
      className="comparison-slot"
      ref={sectionRef}
      onDragOver={(event) => {
        if (disabled) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
      }}
      onDrop={(event) => {
        if (disabled) return
        event.preventDefault()
        handleFiles(Array.from(event.dataTransfer.files))
      }}
    >
      <h2 id={`comparison-${side}-title`}>{COMPARISON_SIDE_LABELS[side]}</h2>
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label={`${COMPARISON_SIDE_LABELS[side]} 파일 선택`}
        disabled={disabled}
        hidden
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />
      {isRenderableComparisonSlot(slot) && showReadyPreview ? (
        <ReadyPreview side={side} slot={slot} />
      ) : slot.kind === "pending" || slot.kind === "analyzing" || slot.kind === "error" ? (
        <img alt={`${COMPARISON_SIDE_LABELS[side]} 선택 미리보기`} src={slot.previewUrl} />
      ) : (
        <div className="comparison-slot__placeholder" aria-hidden="true" />
      )}
      <p aria-live="polite" className="comparison-slot__status">
        {slot.kind === "empty"
          ? "사진 한 장을 선택하거나 놓으세요"
          : slot.kind === "pending"
            ? "분석 준비됨"
            : slot.kind === "analyzing"
              ? "기기 내 분석 중"
              : slot.kind === "ready"
                ? slot.pose.detectionMethod === "profile_recovery"
                  ? "측면 재검출 · 기준점 확인"
                  : "정렬 준비 완료"
                : slot.kind === "manual"
                  ? "수동 정렬 · 기준점을 직접 확인해 주세요"
                  : analysisFailureCopy(slot.code)}
      </p>
      {validationError === null ? null : (
        <p className="comparison-slot__error" role="alert">
          {validationError}
        </p>
      )}
      {slot.kind === "error" ? (
        <p className="comparison-slot__recovery">
          이쪽 사진만 다시 분석하거나 교체할 수 있습니다. 다른 쪽 결과는 유지됩니다.
        </p>
      ) : null}
      <div className="comparison-slot__actions">
        <Button
          autoFocus={focusSelect}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          variant={selected ? "secondary" : "primary"}
        >
          <UploadSimple aria-hidden="true" size={17} /> {selected ? "사진 교체" : "사진 선택"}
        </Button>
        {slot.kind === "error" ? (
          <Button disabled={disabled} onClick={onRetry}>
            <ArrowClockwise aria-hidden="true" size={17} /> 다시 분석
          </Button>
        ) : null}
        {slot.kind === "error" &&
        slot.code === "face_not_detected" &&
        slot.decoded !== undefined &&
        onManual !== undefined ? (
          <Button disabled={disabled} onClick={onManual} variant="secondary">
            기준점 직접 지정
          </Button>
        ) : null}
        {!selected ? null : (
          <Button
            aria-label={`${COMPARISON_SIDE_LABELS[side]} 제거`}
            disabled={disabled}
            onClick={onRemove}
            variant="quiet"
          >
            <Trash aria-hidden="true" size={17} /> 제거
          </Button>
        )}
      </div>
    </section>
  )
}
