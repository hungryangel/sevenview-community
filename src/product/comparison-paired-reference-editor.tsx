import { useMemo, useReducer } from "react"
import type { ComparisonAngle, ComparisonSide } from "../domain/comparison"
import {
  type ComparisonReferencePair,
  comparisonReferenceReducer,
  completeReferencePair,
  createComparisonReferenceDraft,
  type ReferenceOrdinal,
  referencePairError,
} from "../domain/comparison-reference-pair"
import type { RegistrationReferences } from "../domain/comparison-registration"
import type { Point } from "../domain/types"
import { Button } from "../ui/button"
import { ComparisonPairedSource } from "./comparison-paired-source"
import { ComparisonPreview, type ReadyComparisonSlot } from "./comparison-preview"
import { buildComparisonRenderModel, EMPTY_COMPARISON_ADJUSTMENT } from "./comparison-render-model"

type Props = {
  readonly pair: { readonly before: ReadyComparisonSlot; readonly after: ReadyComparisonSlot }
  readonly angle: ComparisonAngle
  readonly initialReferences?: Readonly<Partial<Record<ComparisonSide, RegistrationReferences>>>
  readonly active: boolean
  readonly disabled: boolean
  readonly onApply: (references: ComparisonReferencePair) => void
  readonly onCancel: () => void
}
const SIDE_LABEL = { before: "시술 전", after: "시술 후" } as const
const ORDINAL_LABEL = { first: "①", second: "②" } as const

function candidate(
  slot: ReadyComparisonSlot,
  angle: ComparisonAngle,
  ordinal: ReferenceOrdinal,
): Point | null {
  if (slot.kind !== "ready") return null
  const geometry = slot.pose.landmarkGeometry
  if (angle !== "front") {
    if (geometry === undefined) return null
    return ordinal === "first" ? geometry.named.forehead : geometry.named.noseBridgeLower
  }
  const anchors = slot.pose.registrationAnchors
  if (anchors === undefined) return null
  return ordinal === "first" ? anchors.screenLeftEye : anchors.screenRightEye
}

function stepSentence(step: ReturnType<typeof createComparisonReferenceDraft>["step"]): string {
  if (step.kind === "preview") return "정렬 미리보기를 확인하고 적용하세요."
  if (step.kind === "confirm")
    return `두 사진의 기준점 ${ORDINAL_LABEL[step.ordinal]}이 같은 부위인지 확인하세요.`
  return `${SIDE_LABEL[step.side]} 원본에서 기준점 ${ORDINAL_LABEL[step.ordinal]}을 선택하세요.`
}

export function ComparisonPairedReferenceEditor({
  active,
  angle,
  disabled,
  initialReferences = {},
  onApply,
  onCancel,
  pair,
}: Props) {
  const [draft, dispatch] = useReducer(
    comparisonReferenceReducer,
    initialReferences,
    createComparisonReferenceDraft,
  )
  const complete = completeReferencePair(draft)
  const model = useMemo(
    () =>
      complete === null
        ? null
        : buildComparisonRenderModel({
            angle,
            manualRecovery: true,
            manualReferences: complete,
            pair,
            residual: EMPTY_COMPARISON_ADJUSTMENT,
            revision: 0,
          }),
    [angle, complete, pair],
  )
  const preview = model?.kind === "ready" ? model : null
  const validationMessage =
    referencePairError(draft) ??
    (draft.step.kind === "preview" && model?.kind === "reviewRequired"
      ? "이 기준점 조합으로 정렬할 수 없습니다. 두 점의 위치를 다시 확인해 주세요."
      : null)
  const place = (side: ComparisonSide, ordinal: ReferenceOrdinal, point: Point) =>
    dispatch({ type: "place", side, ordinal, point })
  return (
    <div aria-busy={disabled} className="comparison-paired-workbench">
      <p aria-live="polite" className="comparison-paired-workbench__step">
        {stepSentence(draft.step)}
      </p>
      <div
        className="comparison-paired-workbench__source-area"
        data-preview={draft.step.kind === "preview"}
      >
        <div className="comparison-paired-workbench__sources">
          {(["before", "after"] as const).map((side) => (
            <ComparisonPairedSource
              active={active}
              disabled={disabled}
              key={side}
              onPlace={(point) =>
                draft.step.kind === "place" && draft.step.side === side
                  ? place(side, draft.step.ordinal, point)
                  : undefined
              }
              points={draft.references[side] ?? {}}
              selected={draft.step.kind === "place" && draft.step.side === side}
              side={side}
              slot={pair[side]}
              suggestion={
                draft.step.kind === "place" && draft.step.side === side
                  ? candidate(pair[side], angle, draft.step.ordinal)
                  : null
              }
            />
          ))}
        </div>
        {draft.step.kind === "place" ? (
          <div className="comparison-paired-workbench__suggestions">
            {(["before", "after"] as const).map((side) => {
              const point = candidate(
                pair[side],
                angle,
                draft.step.kind === "place" ? draft.step.ordinal : "first",
              )
              return point === null ? null : (
                <Button
                  disabled={disabled || draft.step.kind !== "place" || side !== draft.step.side}
                  key={side}
                  onClick={() =>
                    place(side, draft.step.kind === "place" ? draft.step.ordinal : "first", point)
                  }
                  variant="quiet"
                >
                  {SIDE_LABEL[side]} 모델 제안 수락
                </Button>
              )
            })}
          </div>
        ) : null}
        <div className="comparison-paired-workbench__pairs">
          {(["first", "second"] as const).map((ordinal) => (
            <Button
              aria-pressed={draft.step.kind !== "preview" && draft.step.ordinal === ordinal}
              disabled={disabled}
              key={ordinal}
              onClick={() => dispatch({ type: "revise", ordinal })}
              variant="quiet"
            >
              기준점 {ORDINAL_LABEL[ordinal]} 다시 선택
            </Button>
          ))}
          {draft.step.kind === "confirm" ? (
            <Button
              disabled={disabled}
              onClick={() => dispatch({ type: "confirm" })}
              variant="primary"
            >
              같은 부위 확인
            </Button>
          ) : null}
        </div>
      </div>
      {preview === null ? null : (
        <section className="comparison-paired-workbench__preview" aria-label="정렬 미리보기">
          <ComparisonPreview angle={angle} render={preview.before} side="before" />
          <ComparisonPreview angle={angle} render={preview.after} side="after" />
        </section>
      )}
      {validationMessage === null ? null : (
        <p className="comparison-paired-workbench__error" role="alert">
          {validationMessage}
        </p>
      )}
      <details className="comparison-paired-workbench__details">
        <summary>선택 좌표</summary>
        <dl>
          {(["before", "after"] as const).flatMap((side) =>
            (["first", "second"] as const).map((ordinal) => {
              const point = draft.references[side]?.[ordinal]
              return point === undefined ? null : (
                <div key={`${side}-${ordinal}`}>
                  <dt>
                    {SIDE_LABEL[side]} {ORDINAL_LABEL[ordinal]}
                  </dt>
                  <dd>
                    {point.x.toFixed(4)}, {point.y.toFixed(4)}
                  </dd>
                </div>
              )
            }),
          )}
        </dl>
      </details>
      <div className="comparison-paired-workbench__actions">
        <Button disabled={disabled} onClick={onCancel}>
          취소
        </Button>
        <Button
          disabled={
            disabled || draft.step.kind !== "preview" || preview === null || complete === null
          }
          onClick={() => {
            if (complete !== null) onApply(complete)
          }}
          variant="primary"
        >
          정렬 적용
        </Button>
      </div>
    </div>
  )
}
