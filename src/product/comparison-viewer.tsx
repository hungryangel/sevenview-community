import { useState } from "react"

import {
  COMPARISON_VIEW_MODES,
  type ComparisonAngle,
  type ComparisonViewMode,
} from "../domain/comparison"
import type { ComparisonExportOrder } from "../domain/comparison-export"
import { Button } from "../ui/button"
import { ComparisonEyePrivacyControl } from "./comparison-eye-privacy-control"
import {
  type ComparisonPhotoInformationMode,
  comparisonPhotoInformation,
} from "./comparison-photo-information"
import type { ReadyComparisonSlot } from "./comparison-preview"
import type { ComparisonRenderModel } from "./comparison-render-model"
import { ComparisonViewerStage } from "./comparison-viewer-stage"
import type { ComparisonEyePrivacyController } from "./use-comparison-eye-privacy"

type ComparisonViewerProps = {
  readonly active?: boolean
  readonly order?: ComparisonExportOrder
  readonly onOrderChange?: (order: ComparisonExportOrder) => void
  readonly disabled?: boolean
  readonly model?: Extract<ComparisonRenderModel, { readonly kind: "ready" }>
  readonly angle?: ComparisonAngle
  readonly pair?: { readonly before: ReadyComparisonSlot; readonly after: ReadyComparisonSlot }
  readonly eyePrivacy?: ComparisonEyePrivacyController
}

const MODE_LABELS = {
  sideBySide: "나란히",
  wipe: "슬라이더",
  toggle: "전후 전환",
} as const satisfies Record<ComparisonViewMode, string>

const INFORMATION_LABELS = {
  faceRegion: "얼굴 영역",
  off: "표시 안 함",
  registration: "정렬 기준점",
  landmarks: "전체 얼굴 기준점",
} as const satisfies Record<ComparisonPhotoInformationMode, string>

export const ANGLE_LABELS = {
  front: "정면",
  rightOblique: "우측 45도",
  leftOblique: "좌측 45도",
  rightProfile: "우측 측면",
  leftProfile: "좌측 측면",
} as const satisfies Record<ComparisonAngle, string>

export function ComparisonViewer({
  model,
  order = "beforeAfter",
  onOrderChange,
  disabled = false,
  active = true,
  eyePrivacy,
}: ComparisonViewerProps) {
  const [mode, setMode] = useState<ComparisonViewMode>("sideBySide")
  const [informationMode, setInformationMode] = useState<ComparisonPhotoInformationMode>("off")
  const [informationOpen, setInformationOpen] = useState(false)
  if (model === undefined) return <p>기준점 확인 필요</p>
  const sourceLimited = model.before.neutralMargin || model.after.neutralMargin

  return (
    <section aria-labelledby="comparison-viewer-title" className="comparison-viewer">
      <div className="comparison-viewer__heading">
        <div>
          <h2 id="comparison-viewer-title">정렬된 비교</h2>
          <p>비교 방향 · {ANGLE_LABELS[model.angle]}</p>
          <p className="comparison-angle__hint">
            {model.after.fit !== undefined
              ? `상부 얼굴 ${model.after.fit.inlierCount}/${model.after.fit.referenceCount}개 기준점으로 정렬 · 모델 추정값을 확인하세요`
              : model.before.provenance === "manual" || model.after.provenance === "manual"
                ? "직접 지정한 두 기준점으로 정렬 · 자동 검출 결과가 아닙니다"
                : "두 기준점으로 정렬 · 기준점을 확인하세요"}
          </p>
        </div>
        <div className="comparison-viewer__toolbar">
          <fieldset className="comparison-viewer__modes">
            <legend className="sr-only">비교 보기</legend>
            {COMPARISON_VIEW_MODES.map((candidate) => (
              <Button
                aria-pressed={mode === candidate}
                disabled={disabled || !active}
                key={candidate}
                onClick={() => {
                  setMode(candidate)
                }}
                variant="quiet"
              >
                {MODE_LABELS[candidate]}
              </Button>
            ))}
          </fieldset>
          {onOrderChange === undefined ? null : (
            <Button
              disabled={disabled}
              onClick={() => onOrderChange(order === "beforeAfter" ? "afterBefore" : "beforeAfter")}
              variant="secondary"
            >
              표시 순서 바꾸기
            </Button>
          )}
        </div>
      </div>

      <details
        className="comparison-viewer__information"
        onToggle={(event) => {
          setInformationOpen(event.currentTarget.open)
          if (!event.currentTarget.open) setInformationMode("off")
        }}
      >
        <summary>
          사진 위 정보{informationMode === "off" ? "" : ` · ${INFORMATION_LABELS[informationMode]}`}
        </summary>
        {informationOpen ? (
          <fieldset>
            <legend className="sr-only">사진 위 정보 표시</legend>
            {(["off", "registration", "faceRegion", "landmarks"] as const).map((candidate) => (
              <Button
                aria-pressed={informationMode === candidate}
                key={candidate}
                onClick={() => setInformationMode(candidate)}
                variant="quiet"
              >
                {INFORMATION_LABELS[candidate]}
              </Button>
            ))}
          </fieldset>
        ) : null}
      </details>

      <div>
        <ComparisonViewerStage
          active={active}
          disabled={disabled}
          model={model}
          mode={mode}
          informationMode={informationMode}
          order={order}
          {...(eyePrivacy === undefined ? {} : { eyePrivacy })}
        />
      </div>
      {eyePrivacy === undefined ? null : (
        <ComparisonEyePrivacyControl
          active={active}
          busy={disabled}
          controller={eyePrivacy}
          model={model}
        />
      )}

      {informationMode === "off" ? null : (
        <div aria-live="polite" className="comparison-viewer__information-legend">
          {(["before", "after"] as const).map((side) => {
            const information = comparisonPhotoInformation(
              model[side],
              informationMode,
              model.angle,
            )
            const sideLabel = side === "before" ? "시술 전" : "시술 후"
            if (information.kind === "unavailable") {
              return (
                <p key={side}>
                  {sideLabel} · {INFORMATION_LABELS[informationMode]} · 표시할 실제 위치 정보 없음
                </p>
              )
            }
            if (information.kind === "registration") {
              return (
                <p key={side}>
                  {sideLabel} · 정렬 기준점 ·{" "}
                  {information.provenance === "detected" ? "자동 감지" : "수동 지정"} ·{" "}
                  {information.points
                    .map((point, index) => `${index + 1} ${point.label}`)
                    .join(" · ")}
                </p>
              )
            }
            if (information.kind === "landmarks")
              return (
                <p key={side}>
                  {sideLabel} · 모델이 추정한 {information.points.length}개 점 ·{" "}
                  {information.named
                    .map((point, index) => `${index + 1} ${point.label}`)
                    .join(" · ")}
                  . 이마 중앙은 모발 경계가 아닙니다. 귀 위치는 검출하지 않습니다. 턱·윤곽은
                  관찰용이며 모양을 강제로 맞추지 않습니다.
                </p>
              )
            return (
              <p key={side}>{sideLabel} · 얼굴 영역 · 원본 분석 위치 · 사각 영역과 검출 중심</p>
            )
          })}
        </div>
      )}

      {sourceLimited ? (
        <p className="comparison-viewer__source-limit">원본 여백 부족 · 중립 여백으로 유지</p>
      ) : null}
    </section>
  )
}
