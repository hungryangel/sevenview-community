import { useEffect, useId, useRef, useState } from "react"
import type { RegistrationReferences } from "../domain/comparison-registration"
import type { ImageSize, Point } from "../domain/types"
import { Button } from "../ui/button"
import { useComparisonEditorDrag } from "./comparison-editor-drag"

type ReferenceIndex = "first" | "second"
type Props = {
  readonly disabled?: boolean
  readonly file: File
  readonly label: string
  readonly onChange: (index: ReferenceIndex, point: Point) => void
  readonly pointLabels: readonly [string, string]
  readonly provenanceLabel: string
  readonly references: RegistrationReferences
  readonly size: ImageSize
}

export function ComparisonSourceReferencePicker({
  disabled = false,
  file,
  label,
  onChange,
  pointLabels,
  provenanceLabel,
  references,
  size,
}: Props) {
  const [url, setUrl] = useState("")
  const [selected, setSelected] = useState<ReferenceIndex>("first")
  const markers = useRef<Partial<Record<ReferenceIndex, HTMLButtonElement>>>({})
  const hintId = useId()
  const drag = useComparisonEditorDrag(!disabled)
  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return (
    <section className="comparison-editor-source">
      <div className="comparison-editor-source__header">
        <h3>{label} 기준점</h3>
        <p>{provenanceLabel}</p>
      </div>
      <div
        className="comparison-reference-editor__original"
        style={{ aspectRatio: `${size.width} / ${size.height}` }}
      >
        {url === "" ? null : <img alt={`${label} 원본 기준점 편집`} draggable={false} src={url} />}
        {(["first", "second"] as const).map((index, ordinal) => {
          const point = {
            x: references[index].x / size.width,
            y: references[index].y / size.height,
          }
          return (
            <button
              aria-describedby={hintId}
              aria-label={`${label} ${pointLabels[ordinal]} 기준점 ${ordinal + 1}`}
              aria-pressed={selected === index}
              className="comparison-editor-source__marker"
              disabled={disabled}
              key={index}
              onFocus={() => setSelected(index)}
              onKeyDown={(event) => {
                if (disabled) return
                const step = event.shiftKey ? 0.01 : 0.001
                const movements: Readonly<Record<string, Point>> = {
                  ArrowLeft: { x: -step, y: 0 },
                  ArrowRight: { x: step, y: 0 },
                  ArrowUp: { x: 0, y: -step },
                  ArrowDown: { x: 0, y: step },
                }
                const movement = movements[event.key]
                if (movement === undefined) return
                event.preventDefault()
                onChange(index, {
                  x: Math.min(1, Math.max(0, point.x + movement.x)),
                  y: Math.min(1, Math.max(0, point.y + movement.y)),
                })
              }}
              onPointerDown={(event) => {
                const bounds = event.currentTarget.parentElement?.getBoundingClientRect()
                if (bounds === undefined || bounds.width === 0 || bounds.height === 0) return
                setSelected(index)
                event.currentTarget.focus()
                drag.start(event, (position) =>
                  onChange(index, {
                    x: Math.min(1, Math.max(0, (position.clientX - bounds.left) / bounds.width)),
                    y: Math.min(1, Math.max(0, (position.clientY - bounds.top) / bounds.height)),
                  }),
                )
              }}
              ref={(element) => {
                if (element === null) delete markers.current[index]
                else markers.current[index] = element
              }}
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
              type="button"
            >
              <span>{ordinal + 1}</span>
            </button>
          )
        })}
      </div>
      <div className="comparison-editor-source__selection">
        {(["first", "second"] as const).map((index, ordinal) => (
          <Button
            aria-label={`${label} 기준점 ${ordinal + 1} 선택`}
            aria-pressed={selected === index}
            disabled={disabled}
            key={index}
            onClick={() => markers.current[index]?.focus()}
            variant="quiet"
          >
            {ordinal + 1} · {pointLabels[ordinal]}
          </Button>
        ))}
      </div>
      <p id={hintId}>
        점을 끌어 맞추세요. 선택한 점은 방향키로 미세 이동 · Shift로 크게 이동합니다.
      </p>
    </section>
  )
}
