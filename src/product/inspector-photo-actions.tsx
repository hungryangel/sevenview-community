import { ArrowCounterClockwise, TrayArrowDown } from "@phosphor-icons/react"
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from "react"
import { VIEW_IDS, type ViewId } from "../domain/types"
import { VIEW_LABELS } from "../domain/workspace"
import { Button } from "../ui/button"
import type { InspectorPanelProps } from "./inspector-panel"

function isViewId(value: string): value is ViewId {
  return VIEW_IDS.some((view) => view === value)
}

export function useInspectorReplacement(onReplace: (file: File) => void) {
  const [replaceDropActive, setReplaceDropActive] = useState(false)
  const handleReplacement = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (file !== undefined) {
      onReplace(file)
    }
    event.currentTarget.value = ""
  }
  // 사진 교체는 파일 선택뿐 아니라 드롭으로도(2026-09-02 bee 지적) —
  // 미리보기와 교체 버튼이 선택 뷰의 드롭 타깃이다. preventDefault로 개별
  // 처리하면 전역 드롭 훅은 물러난다(defaultPrevented 규약).
  const handleReplaceDragOver = (event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    setReplaceDropActive(true)
  }
  const handleReplaceDragLeave = () => setReplaceDropActive(false)
  const handleReplaceDrop = (event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) {
      return
    }
    event.preventDefault()
    setReplaceDropActive(false)
    const file = Array.from(event.dataTransfer.files).find((candidate) =>
      candidate.type.startsWith("image/"),
    )
    if (file !== undefined) {
      onReplace(file)
    }
  }

  return {
    replaceDropActive,
    handleReplacement,
    handleReplaceDragOver,
    handleReplaceDragLeave,
    handleReplaceDrop,
  }
}

type Props = Pick<
  InspectorPanelProps,
  "photo" | "views" | "onRemoveToSpares" | "onAssignView" | "onReset" | "onResetAll"
> & { readonly replacement: ReturnType<typeof useInspectorReplacement> }
export function InspectorPhotoActions({
  photo,
  views,
  onRemoveToSpares,
  onAssignView,
  onReset,
  onResetAll,
  replacement,
}: Props) {
  const [confirmingResetAll, setConfirmingResetAll] = useState(false)
  const resetTriggerRef = useRef<HTMLButtonElement>(null)
  const cancelResetRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (confirmingResetAll) cancelResetRef.current?.focus()
  }, [confirmingResetAll])
  const closeResetConfirmation = () => {
    setConfirmingResetAll(false)
    resetTriggerRef.current?.focus()
  }
  const {
    replaceDropActive,
    handleReplacement,
    handleReplaceDragOver,
    handleReplaceDragLeave,
    handleReplaceDrop,
  } = replacement
  return (
    <>
      <div className="inspector-panel__photo-actions">
        <label
          className={`button button--secondary inspector-panel__replace${replaceDropActive ? " inspector-panel__replace--drop" : ""}`}
          onDragLeave={handleReplaceDragLeave}
          onDragOver={handleReplaceDragOver}
          onDrop={handleReplaceDrop}
        >
          사진 교체
          <input
            accept="image/jpeg,image/png,image/webp"
            aria-label={`${VIEW_LABELS[photo.view]} 사진 교체`}
            onChange={handleReplacement}
            type="file"
          />
        </label>
        <Button onClick={onRemoveToSpares} variant="secondary">
          <TrayArrowDown aria-hidden="true" size={16} /> 예비로 빼기
        </Button>
        <small>사진을 여기로 끌어 놓아도 교체됩니다.</small>
      </div>
      <label className="inspector-panel__assignment">
        뷰 수동 지정
        <select
          aria-label="뷰 수동 지정"
          onChange={(event) => {
            const targetView = event.currentTarget.value
            if (isViewId(targetView)) {
              onAssignView(targetView)
            }
          }}
          value={photo.view}
        >
          {views.map((view) => (
            <option key={view} value={view}>
              {VIEW_LABELS[view]}
            </option>
          ))}
        </select>
      </label>
      <Button className="inspector-panel__reset" onClick={onReset} variant="secondary">
        <ArrowCounterClockwise aria-hidden="true" size={18} /> 선택 사진 초기화
      </Button>
      <Button
        aria-expanded={confirmingResetAll}
        className="inspector-panel__reset-all"
        onClick={() => setConfirmingResetAll(true)}
        ref={resetTriggerRef}
        variant="secondary"
      >
        전체 기본값 재설정
      </Button>
      {confirmingResetAll ? (
        <div
          aria-label="전체 기본값 재설정 확인"
          className="inspector-panel__reset-confirmation"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return
            event.preventDefault()
            event.stopPropagation()
            closeResetConfirmation()
          }}
          role="alertdialog"
        >
          <p>모든 사진의 위치·회전·배율을 기본값으로 되돌릴까요?</p>
          <div>
            <Button onClick={closeResetConfirmation} ref={cancelResetRef} variant="quiet">
              취소
            </Button>
            <Button
              onClick={() => {
                onResetAll()
                closeResetConfirmation()
              }}
              variant="secondary"
            >
              전체 초기화 실행
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
