import { useState } from "react"
import type { ComparisonSide } from "../domain/comparison"
import type { CropAdjustment, Point } from "../domain/types"
import { Button } from "../ui/button"
import { ComparisonEditorResidual } from "./comparison-editor-residual"
import { ComparisonSourceReferencePicker } from "./comparison-editor-source"
import { comparisonReferenceLabels } from "./comparison-reference-labels"
import type { ComparisonRenderModel } from "./comparison-render-model"

type ComparisonReferenceEditorProps = {
  readonly active?: boolean
  readonly disabled?: boolean
  readonly pairedEditing?: boolean
  readonly model: Extract<ComparisonRenderModel, { readonly kind: "ready" }>
  readonly onReferenceChange: (
    side: ComparisonSide,
    index: "first" | "second",
    point: Point,
  ) => void
  readonly onResetReferences: () => void
  readonly onResidualChange: (adjustment: CropAdjustment) => void
}

const SIDE_LABEL = { after: "시술 후", before: "시술 전" } as const

export function ComparisonReferenceEditor({
  active = true,
  disabled = false,
  pairedEditing = false,
  model,
  onReferenceChange,
  onResetReferences,
  onResidualChange,
}: ComparisonReferenceEditorProps) {
  const [open, setOpen] = useState(false)
  const locked = !active || disabled
  return (
    <details
      className="comparison-reference-editor"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{pairedEditing ? "위치·배율 미세 조정" : "기준점·위치 조정"}</summary>
      {open ? (
        <div className="comparison-reference-editor__content">
          {pairedEditing ? null : (
            <div className="comparison-editor-sources">
              <p>실제 촬영 기준을 균일 배율·회전·이동으로 맞추며 얼굴 형태를 바꾸지 않습니다.</p>
              <div className="comparison-reference-editor__sources">
                {(["before", "after"] as const).map((side) => (
                  <ComparisonSourceReferencePicker
                    disabled={locked}
                    file={model[side].slot.file}
                    key={side}
                    label={SIDE_LABEL[side]}
                    onChange={(index, point) => onReferenceChange(side, index, point)}
                    pointLabels={comparisonReferenceLabels(model[side], model.angle)}
                    provenanceLabel={
                      model[side].provenance === "detected" ? "자동 감지" : "수동 지정"
                    }
                    references={model[side].references}
                    size={model[side].slot.decoded}
                  />
                ))}
              </div>
              <Button disabled={locked} onClick={onResetReferences} variant="secondary">
                {model.before.slot.kind === "manual" || model.after.slot.kind === "manual"
                  ? "기준점 다시 지정"
                  : "자동 기준점으로 재설정"}
              </Button>
            </div>
          )}
          <ComparisonEditorResidual disabled={locked} model={model} onChange={onResidualChange} />
        </div>
      ) : null}
    </details>
  )
}
