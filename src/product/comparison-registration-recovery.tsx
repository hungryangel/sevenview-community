import { isRenderableComparisonSlot } from "../domain/comparison-session"
import type { ComparisonIntakeProps } from "./comparison-intake-types"
import { ComparisonReferenceRecovery } from "./comparison-reference-recovery"

export function ComparisonRegistrationRecovery({
  props,
  disabled,
}: {
  readonly props: ComparisonIntakeProps
  readonly disabled: boolean
}) {
  const model = props.renderModel
  if (model?.kind !== "reviewRequired") return null
  const rotationReview = model.reason === "rotation_review_required"
  const sides = ["before", "after"] as const
  return (
    <section aria-label="정렬 기준 확인">
      <p role="status">
        두 사진의 같은 부위에 기준점 1·2를 지정합니다. 시술 전 사진의 원래 방향은 유지합니다.
      </p>
      {rotationReview ? (
        <p role="status">
          자동 기준점으로는 회전 차이가 큽니다. 사진은 회전하지 않았습니다. 두 사진에서 서로
          대응하는 기준점 두 개씩을 직접 확인해 주세요.
        </p>
      ) : null}
      {sides.map((side) => {
        const slot = props[side]
        if (!isRenderableComparisonSlot(slot)) return null
        return (
          <ComparisonReferenceRecovery
            key={side}
            disabled={disabled}
            file={slot.file}
            onChange={(references) => props.onReferencesChange?.(side, references)}
            side={side}
            sourceSize={slot.decoded}
          />
        )
      })}
    </section>
  )
}
