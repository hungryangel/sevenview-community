import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef } from "react"
import { drawEyeMosaicInSource } from "../adapters/eye-mosaic"
import { createManualEyePrivacyMask } from "../domain/comparison-eye-privacy"
import type { Point, Rect } from "../domain/types"
import { Button } from "../ui/button"
import type { ReadyComparisonSlot } from "./comparison-preview"

const SIDE_LABEL = { before: "시술 전", after: "시술 후" } as const

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function fromClient(event: PointerEvent<HTMLCanvasElement>): Point | null {
  const bounds = event.currentTarget.getBoundingClientRect()
  if (bounds.width === 0 || bounds.height === 0) return null
  return {
    x: clamp((event.clientX - bounds.left) / bounds.width),
    y: clamp((event.clientY - bounds.top) / bounds.height),
  }
}

function moved(rect: Rect, x: number, y: number): Rect {
  const width = rect.right - rect.left
  const height = rect.bottom - rect.top
  const left = clamp(Math.min(1 - width, rect.left + x))
  const top = clamp(Math.min(1 - height, rect.top + y))
  return { left, top, right: left + width, bottom: top + height }
}

function resized(rect: Rect, x: number, y: number): Rect {
  return {
    left: clamp(Math.min(rect.right - 0.01, rect.left - x / 2)),
    right: clamp(Math.max(rect.left + 0.01, rect.right + x / 2)),
    top: clamp(Math.min(rect.bottom - 0.01, rect.top - y / 2)),
    bottom: clamp(Math.max(rect.top + 0.01, rect.bottom + y / 2)),
  }
}

export function ComparisonEyeMaskEditor(props: {
  readonly active: boolean
  readonly busy: boolean
  readonly draft: Rect
  readonly onApply: () => boolean
  readonly onCancel: () => void
  readonly onChange: (rect: Rect) => void
  readonly side: "before" | "after"
  readonly slot: ReadyComparisonSlot
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragStart = useRef<Point | null>(null)
  const titleId = useId()
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
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (canvas === null || context == null) return
    context.drawImage(props.slot.decoded.image, 0, 0, canvas.width, canvas.height)
    const mask = createManualEyePrivacyMask(props.draft)
    if (mask !== null)
      drawEyeMosaicInSource(
        context,
        props.slot.decoded.image,
        { width: canvas.width, height: canvas.height },
        mask,
      )
  }, [props.draft, props.slot])
  const handleKey = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (!props.active || props.busy) return
    const step = event.altKey ? 0.01 : 0.002
    const delta = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    }[event.key]
    if (delta === undefined) return
    event.preventDefault()
    props.onChange(
      event.shiftKey
        ? resized(props.draft, delta.x, delta.y)
        : moved(props.draft, delta.x, delta.y),
    )
  }
  return (
    <dialog
      aria-labelledby={titleId}
      className="comparison-eye-mask-dialog"
      onCancel={(event) => {
        event.preventDefault()
        props.onCancel()
      }}
      ref={dialogRef}
    >
      <header>
        <div>
          <h2 id={titleId}>{SIDE_LABEL[props.side]} 눈 모자이크 범위</h2>
          <p>원본 위를 드래그하세요. 방향키로 이동하고 Shift+방향키로 크기를 조정합니다.</p>
        </div>
        <Button onClick={props.onCancel} variant="quiet">
          닫기
        </Button>
      </header>
      <div className="comparison-eye-mask-editor">
        <canvas
          aria-label={`${SIDE_LABEL[props.side]} 원본 눈 모자이크 범위 편집`}
          height={props.slot.decoded.height}
          onKeyDown={handleKey}
          onPointerDown={(event) => {
            if (!props.active || props.busy) return
            const point = fromClient(event)
            if (point === null) return
            dragStart.current = point
            event.currentTarget.setPointerCapture?.(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) return
            const start = dragStart.current
            const point = fromClient(event)
            if (start === null || point === null) return
            props.onChange({
              left: Math.min(start.x, point.x),
              top: Math.min(start.y, point.y),
              right: Math.max(start.x, point.x),
              bottom: Math.max(start.y, point.y),
            })
          }}
          onPointerUp={(event) => {
            dragStart.current = null
            event.currentTarget.releasePointerCapture?.(event.pointerId)
          }}
          ref={canvasRef}
          role="img"
          tabIndex={props.active && !props.busy ? 0 : -1}
          width={props.slot.decoded.width}
        />
      </div>
      <footer>
        <Button onClick={props.onCancel} variant="secondary">
          취소
        </Button>
        <Button
          disabled={props.busy || createManualEyePrivacyMask(props.draft) === null}
          onClick={props.onApply}
          variant="primary"
        >
          범위 적용
        </Button>
      </footer>
    </dialog>
  )
}
