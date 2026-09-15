import {
  ArrowsDownUp,
  CaretLeft,
  CaretRight,
  CheckCircle,
  ImageSquare,
  SpinnerGap,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react"
import { type ReactNode, useState } from "react"

export type ViewSlotState = "empty" | "analyzing" | "ready" | "warning" | "error"
export type ViewSlotVariant = "rail" | "contactSheet" | "filmstrip"

type ViewSlotProps = {
  readonly adjusted?: boolean
  readonly assignmentMethod?: "auto" | "manual" | undefined
  // 마우스를 올리거나 포커스가 들어오면 보이는 투명 정보 팝업(2026-09-02).
  readonly detail?: ReactNode
  readonly index: number
  readonly label: string
  readonly onSelect?: () => void
  readonly onMoveEarlier?: (() => void) | undefined
  readonly onMoveLater?: (() => void) | undefined
  readonly preview?: ReactNode
  readonly selected?: boolean
  readonly sourcePhotoId?: string | undefined
  readonly state: ViewSlotState
  readonly statusText?: string | undefined
  // 타일 모서리에 얹는 작은 도구(예: 확대경 켬/끔). 타일 버튼 안에 버튼을 넣을 수 없어 형제로 둔다.
  readonly tools?: ReactNode
  readonly variant?: ViewSlotVariant
}

function SlotState({
  assignmentMethod,
  state,
  statusText,
}: {
  readonly assignmentMethod: "auto" | "manual"
  readonly state: ViewSlotState
  readonly statusText?: string | undefined
}) {
  switch (state) {
    case "empty":
      return <span>{statusText ?? "사진 없음"}</span>
    case "analyzing":
      return (
        <span>
          <SpinnerGap aria-hidden="true" className="view-slot__spinner" size={14} /> 분석 중
        </span>
      )
    case "ready":
      return (
        <span>
          <CheckCircle aria-hidden="true" size={14} weight="fill" />{" "}
          {assignmentMethod === "manual" ? "수동" : "자동"}
        </span>
      )
    case "warning":
      return (
        <span>
          <WarningCircle aria-hidden="true" size={14} weight="fill" />{" "}
          {assignmentMethod === "manual"
            ? `수동 · ${statusText ?? "검토 필요"}`
            : (statusText ?? "검토 필요")}
        </span>
      )
    case "error":
      return (
        <span>
          <XCircle aria-hidden="true" size={14} weight="fill" /> {statusText ?? "감지 실패"}
        </span>
      )
  }
}

export function ViewSlot({
  adjusted = false,
  assignmentMethod = "auto",
  detail,
  index,
  label,
  onSelect,
  onMoveEarlier,
  onMoveLater,
  preview,
  selected = false,
  sourcePhotoId,
  state,
  statusText,
  tools,
  variant = "rail",
}: ViewSlotProps) {
  const [reorderOpen, setReorderOpen] = useState(false)
  const canReorder = onMoveEarlier !== undefined || onMoveLater !== undefined

  return (
    <div className={`view-slot-wrap view-slot-wrap--${variant}`}>
      <button
        aria-current={selected ? "true" : undefined}
        className={`view-slot view-slot--${state}`}
        data-source-photo-id={sourcePhotoId}
        onClick={onSelect}
        type="button"
      >
        {variant === "contactSheet" ? null : <span className="view-slot__index">{index}</span>}
        <span className="view-slot__preview">
          {preview ?? <ImageSquare aria-hidden="true" size={24} />}
        </span>
        <span className="view-slot__body">
          {variant === "contactSheet" ? (
            <span className="view-slot__tile-label">
              <span className="view-slot__index">{index}</span>
              <strong>{label}</strong>
            </span>
          ) : (
            <strong>{label}</strong>
          )}
          <span className="view-slot__meta">
            {adjusted && state === "ready" ? (
              // 손댄 사진은 '✓ 자동' 자리에 '수동보정' 하나만 (bee 2026-09-03). 경고·오류 상태는
              // 상태 문구가 우선이라 그 뒤에 덧붙인다.
              <span className="view-slot__adjusted">수동보정</span>
            ) : (
              <>
                <SlotState
                  assignmentMethod={assignmentMethod}
                  state={state}
                  statusText={statusText}
                />
                {adjusted ? <span className="view-slot__adjusted">수동보정</span> : null}
              </>
            )}
          </span>
        </span>
      </button>
      {tools === undefined ? null : <div className="view-slot__tools">{tools}</div>}
      {detail === undefined ? null : (
        <div className="view-slot__detail" role="tooltip">
          {detail}
        </div>
      )}
      {!canReorder ? null : (
        <div className="view-slot__reorder">
          <button
            aria-expanded={reorderOpen}
            aria-label={`${label} 순서 변경`}
            className="view-slot__reorder-trigger"
            onClick={() => setReorderOpen((open) => !open)}
            type="button"
          >
            <ArrowsDownUp aria-hidden="true" size={16} />
          </button>
          {!reorderOpen ? null : (
            <div className="view-slot__reorder-menu">
              <button
                aria-label={`${label} 앞 순서로 이동`}
                disabled={onMoveEarlier === undefined}
                onClick={onMoveEarlier}
                type="button"
              >
                <CaretLeft aria-hidden="true" size={14} />
              </button>
              <button
                aria-label={`${label} 뒤 순서로 이동`}
                disabled={onMoveLater === undefined}
                onClick={onMoveLater}
                type="button"
              >
                <CaretRight aria-hidden="true" size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
