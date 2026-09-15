import { useId } from "react"
import type { CropAdjustment, Point } from "../domain/types"
import { Button } from "../ui/button"
import { InspectorControl } from "../ui/inspector-control"
import { signedDegrees } from "./adjustment-readout"
import { useComparisonEditorDrag } from "./comparison-editor-drag"
import { ComparisonPreview } from "./comparison-preview"
import { type ComparisonRenderModel, EMPTY_COMPARISON_ADJUSTMENT } from "./comparison-render-model"

type Props = {
  readonly disabled: boolean
  readonly model: Extract<ComparisonRenderModel, { readonly kind: "ready" }>
  readonly onChange: (adjustment: CropAdjustment) => void
}

function boundedPan(value: number) {
  return Math.round(Math.min(0.1, Math.max(-0.1, value)) * 1000) / 1000
}
function percent(value: number) {
  const n = Math.round(value * 1000) / 10
  return `${n > 0 ? "+" : ""}${n}%`
}

export function ComparisonEditorResidual({ disabled, model, onChange }: Props) {
  const drag = useComparisonEditorDrag(!disabled)
  const hintId = useId()
  const adjustment = model.residual
  const change = (patch: Partial<CropAdjustment>) => onChange({ ...adjustment, ...patch })
  return (
    <section className="comparison-editor-residual">
      <h3>시술 후 위치 보정</h3>
      <p id={hintId}>
        시술 전 위에 시술 후를 50%로 겹쳤습니다. 사진을 끌거나 방향키로 이동하세요. Shift로 크게
        이동합니다.
      </p>
      <div className="comparison-editor-residual__frame">
        <ComparisonPreview angle={model.angle} render={model.before} side="before" />
        <ComparisonPreview
          angle={model.angle}
          className="comparison-editor-residual__after"
          render={model.after}
          side="after"
        />
        <button
          aria-describedby={hintId}
          aria-label="시술 후 사진 위치 직접 조정"
          className="comparison-editor-residual__drag"
          disabled={disabled}
          onKeyDown={(event) => {
            if (disabled) return
            const step = event.shiftKey ? 0.01 : 0.001
            const movements: Readonly<Record<string, Point>> = {
              ArrowLeft: { x: -step, y: 0 },
              ArrowRight: { x: step, y: 0 },
              ArrowUp: { x: 0, y: step },
              ArrowDown: { x: 0, y: -step },
            }
            const movement = movements[event.key]
            if (movement === undefined) return
            event.preventDefault()
            change({
              panX: boundedPan(adjustment.panX + movement.x),
              panY: boundedPan(adjustment.panY + movement.y),
            })
          }}
          onPointerDown={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect()
            if (bounds.width === 0 || bounds.height === 0) return
            const start = { x: event.clientX, y: event.clientY }
            event.currentTarget.focus()
            drag.start(event, (position) =>
              change({
                panX: boundedPan(adjustment.panX + (position.clientX - start.x) / bounds.width),
                panY: boundedPan(adjustment.panY - (position.clientY - start.y) / bounds.height),
              }),
            )
          }}
          type="button"
        />
      </div>
      <p className="comparison-editor-residual__readout">
        가로 {percent(adjustment.panX)} · 세로 {percent(adjustment.panY)} · 회전{" "}
        {signedDegrees(adjustment.rotationDegrees)} · 배율{" "}
        {Math.round(adjustment.scaleMultiplier * 100)}%
      </p>
      <div className="comparison-editor-residual__controls">
        <InspectorControl
          defaultValue={0}
          disabled={disabled}
          hint="− 왼쪽 · + 오른쪽"
          label="가로 위치"
          max={10}
          min={-10}
          onChange={(value) => change({ panX: value / 100 })}
          onReset={() => change({ panX: 0 })}
          step={0.1}
          unit="%"
          value={Math.round(adjustment.panX * 1000) / 10}
        />
        <InspectorControl
          defaultValue={0}
          disabled={disabled}
          hint="− 아래 · + 위"
          label="세로 위치"
          max={10}
          min={-10}
          onChange={(value) => change({ panY: value / 100 })}
          onReset={() => change({ panY: 0 })}
          step={0.1}
          unit="%"
          value={Math.round(adjustment.panY * 1000) / 10}
        />
        <InspectorControl
          defaultValue={0}
          disabled={disabled}
          hint="− 반시계 · + 시계 방향"
          label="회전"
          max={5}
          min={-5}
          onChange={(value) => change({ rotationDegrees: Math.round(value * 10) / 10 })}
          onReset={() => change({ rotationDegrees: 0 })}
          step={0.1}
          unit="°"
          value={adjustment.rotationDegrees}
        />
        <InspectorControl
          defaultValue={100}
          disabled={disabled}
          hint="저장되는 시술 후 사진의 배율"
          label="비교 배율"
          max={120}
          min={80}
          onChange={(value) => change({ scaleMultiplier: value / 100 })}
          onReset={() => change({ scaleMultiplier: 1 })}
          step={1}
          unit="%"
          value={Math.round(adjustment.scaleMultiplier * 100)}
        />
      </div>
      <Button
        disabled={disabled}
        onClick={() => onChange(EMPTY_COMPARISON_ADJUSTMENT)}
        variant="secondary"
      >
        위치·회전·배율 재설정
      </Button>
    </section>
  )
}
