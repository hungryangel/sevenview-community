import { Button } from "../ui/button"
import { ComparisonEyeMaskEditor } from "./comparison-eye-mask-editor"
import type { ComparisonRenderModel } from "./comparison-render-model"
import type { ComparisonEyePrivacyController } from "./use-comparison-eye-privacy"

const SIDE_LABEL = { before: "시술 전", after: "시술 후" } as const

export function ComparisonEyePrivacyControl(props: {
  readonly active: boolean
  readonly busy: boolean
  readonly controller: ComparisonEyePrivacyController
  readonly model: Extract<ComparisonRenderModel, { readonly kind: "ready" }>
}) {
  const editing = props.controller.editingSide
  return (
    <section aria-labelledby="comparison-eye-privacy-title" className="comparison-eye-privacy">
      <div className="comparison-eye-privacy__heading">
        <div>
          <h3 id="comparison-eye-privacy-title">눈 모자이크</h3>
          <p>익명화를 보장하지 않으니 범위를 확인해 주세요.</p>
        </div>
        <Button
          aria-pressed={props.controller.enabled}
          disabled={!props.active || props.busy}
          onClick={() => props.controller.setEnabled(!props.controller.enabled)}
          variant="secondary"
        >
          {props.controller.enabled ? "눈 모자이크 끄기" : "눈 모자이크 켜기"}
        </Button>
      </div>
      {props.controller.enabled ? (
        <div className="comparison-eye-privacy__sides">
          {(["before", "after"] as const).map((side) => {
            const mask = props.controller.masks[side]
            const recoveredProfile =
              props.model[side].slot.kind === "ready" &&
              props.model[side].slot.pose.detectionMethod === "profile_recovery"
            return (
              <div key={side}>
                <p>
                  <strong>{SIDE_LABEL[side]}</strong> ·{" "}
                  {mask === null
                    ? "범위 확인 필요"
                    : mask.provenance === "manual"
                      ? "수동 확인 범위"
                      : recoveredProfile
                        ? "측면 재검출 · 범위 확인"
                        : "자동 감지 범위"}
                </p>
                <Button
                  disabled={!props.active || props.busy}
                  onClick={() => props.controller.beginEdit(side)}
                  variant="quiet"
                >
                  {mask === null ? "범위 지정" : "범위 수정"}
                </Button>
              </div>
            )
          })}
        </div>
      ) : null}
      {editing === null ? null : (
        <ComparisonEyeMaskEditor
          active={props.active}
          busy={props.busy}
          draft={props.controller.draft}
          onApply={props.controller.applyDraft}
          onCancel={props.controller.cancelEdit}
          onChange={props.controller.setDraft}
          side={editing}
          slot={props.model[editing].slot}
        />
      )}
    </section>
  )
}
