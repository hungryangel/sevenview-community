import { useCallback, useEffect, useRef, useState } from "react"
import type { ComparisonSide } from "../domain/comparison"
import type { ReferenceOrdinal } from "../domain/comparison-reference-pair"
import type { Point } from "../domain/types"
import { Button } from "../ui/button"
import { sourcePointFromClient } from "./comparison-paired-coordinate"
import type { ReadyComparisonSlot } from "./comparison-preview"
import { useComparisonSourceCanvas } from "./use-comparison-source-canvas"

const LABEL = { before: "시술 전", after: "시술 후" } as const
const LONG_PRESS_MS = 350

export function ComparisonPairedSource({
  active,
  disabled,
  onPlace,
  points,
  selected,
  side,
  slot,
  suggestion,
}: {
  readonly active: boolean
  readonly disabled: boolean
  readonly onPlace: (point: Point) => void
  readonly points: Partial<Record<ReferenceOrdinal, Point>>
  readonly selected: boolean
  readonly side: ComparisonSide
  readonly slot: ReadyComparisonSlot
  readonly suggestion?: Point | null
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const loupeCanvas = useRef<HTMLCanvasElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const press = useRef<{ id: number; start: Point; point: Point; long: boolean } | null>(null)
  const [loupe, setLoupe] = useState<Point | null>(null)
  const [loupeEnabled, setLoupeEnabled] = useState(true)
  const [cursor, setCursor] = useState<Point>({ x: 0.5, y: 0.5 })
  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    press.current = null
    setLoupe(null)
  }, [])
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) cancel()
    }
    window.addEventListener("blur", cancel)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("blur", cancel)
      document.removeEventListener("visibilitychange", onVisibility)
      cancel()
    }
  }, [cancel])
  useEffect(() => {
    if (!active || disabled || document.hidden) cancel()
  }, [active, disabled, cancel])
  useComparisonSourceCanvas(canvas, loupeCanvas, slot, loupe)
  useEffect(() => {
    if (active && selected && !disabled) canvas.current?.focus({ preventScroll: true })
    else cancel()
  }, [active, selected, disabled, cancel])
  const pointAt = (clientX: number, clientY: number) => {
    const target = canvas.current
    return target === null
      ? null
      : sourcePointFromClient(
          { x: clientX, y: clientY },
          target.getBoundingClientRect(),
          slot.decoded,
        )
  }
  return (
    <section className={`comparison-paired-source${selected ? " is-selected" : ""}`}>
      <h3>{LABEL[side]}</h3>
      <div
        className="comparison-paired-source__frame"
        style={{
          aspectRatio: `${slot.decoded.width} / ${slot.decoded.height}`,
          maxInlineSize: `calc(var(--paired-source-height, 36dvh) * ${slot.decoded.width / slot.decoded.height})`,
        }}
      >
        <canvas
          aria-label={`${LABEL[side]} 원본`}
          height={slot.decoded.height}
          ref={canvas}
          role="img"
          tabIndex={selected && !disabled ? 0 : -1}
          width={slot.decoded.width}
          onFocus={() => {
            if (loupeEnabled && active && !disabled) setLoupe(cursor)
          }}
          onBlur={cancel}
          onPointerCancel={cancel}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") setLoupe(null)
          }}
          onPointerMove={(event) => {
            if (!active || disabled) return
            const point = pointAt(event.clientX, event.clientY)
            if (event.pointerType === "mouse") setLoupe(loupeEnabled ? point : null)
            const current = press.current
            if (
              current !== null &&
              Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y) > 8
            )
              cancel()
          }}
          onPointerDown={(event) => {
            if (!active || !selected || disabled) return
            const point = pointAt(event.clientX, event.clientY)
            if (point === null) return
            if (event.pointerType === "touch") {
              event.currentTarget.setPointerCapture?.(event.pointerId)
              press.current = {
                id: event.pointerId,
                start: { x: event.clientX, y: event.clientY },
                point,
                long: false,
              }
              timer.current = setTimeout(() => {
                if (press.current !== null) {
                  press.current.long = true
                  if (loupeEnabled) setLoupe(point)
                }
              }, LONG_PRESS_MS)
            } else onPlace(point)
          }}
          onPointerUp={(event) => {
            if (!active || disabled) {
              cancel()
              return
            }
            const current = press.current
            if (current === null || current.id !== event.pointerId) return
            onPlace(current.point)
            event.currentTarget.releasePointerCapture?.(event.pointerId)
            cancel()
          }}
          onLostPointerCapture={cancel}
          onKeyDown={(event) => {
            if (!active || !selected || disabled) return
            const step = event.shiftKey ? 0.01 : 0.002
            const delta: Record<string, Point> = {
              ArrowLeft: { x: -step, y: 0 },
              ArrowRight: { x: step, y: 0 },
              ArrowUp: { x: 0, y: -step },
              ArrowDown: { x: 0, y: step },
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onPlace(cursor)
              return
            }
            const move = delta[event.key]
            if (move === undefined) return
            event.preventDefault()
            const next = {
              x: Math.max(0, Math.min(1, cursor.x + move.x)),
              y: Math.max(0, Math.min(1, cursor.y + move.y)),
            }
            setCursor(next)
            if (loupeEnabled) setLoupe(next)
          }}
        />
        {selected ? (
          <span
            aria-hidden="true"
            className="comparison-paired-source__cursor"
            style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
          >
            +
          </span>
        ) : null}
        {(["first", "second"] as const).map((name, index) => {
          const point = points[name]
          return point === undefined ? null : (
            <span
              aria-hidden="true"
              className="comparison-paired-source__marker"
              key={name}
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            >
              {index + 1}
            </span>
          )
        })}
        {suggestion === undefined || suggestion === null ? null : (
          <span
            aria-hidden="true"
            className="comparison-paired-source__suggestion"
            style={{ left: `${suggestion.x * 100}%`, top: `${suggestion.y * 100}%` }}
          />
        )}
        {loupe === null ? null : (
          <div
            className="comparison-paired-source__loupe-shell"
            style={{
              left: loupe.x > 0.5 ? 8 : "auto",
              right: loupe.x > 0.5 ? "auto" : 8,
              top: loupe.y > 0.5 ? 8 : "auto",
              bottom: loupe.y > 0.5 ? "auto" : 8,
            }}
          >
            <canvas
              aria-label={`${LABEL[side]} 선택 위치 3배 확대`}
              className="comparison-paired-source__loupe"
              height="304"
              ref={loupeCanvas}
              role="img"
              width="304"
            />
            <span aria-hidden="true">+</span>
          </div>
        )}
      </div>
      <Button
        aria-pressed={loupeEnabled}
        className="comparison-paired-source__zoom"
        disabled={disabled}
        onClick={() =>
          setLoupeEnabled((value) => {
            if (value) setLoupe(null)
            return !value
          })
        }
        variant="secondary"
      >
        정밀 확대 3×
      </Button>
    </section>
  )
}
