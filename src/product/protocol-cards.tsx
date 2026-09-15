import {
  FRAMING_PRESET_IDS,
  FRAMING_PRESETS,
  type FramingPreset,
  type FramingPresetId,
} from "../domain/protocol-preset"
import {
  VIEW_SET_IDS,
  VIEW_SETS,
  type ViewSet,
  type ViewSetId,
  viewSetRows,
} from "../domain/view-set"
import { VIEW_LABELS, type WorkspacePhoto, type WorkspaceSourcePhoto } from "../domain/workspace"
import { CropPreview } from "./crop-preview"
import {
  currentViewSetState,
  describeViewSetPreview,
  previewViewSetChange,
} from "./view-set-preview"

// 프로토콜 선택 카드(2026-09-03 bee): 뷰 세트·크롭 프레이밍은 "설정"이 아니라 작업 도구다.
// 드롭다운 대신 고르는 즉시 결과가 보이는 카드형 라디오로, 검토 화면 상단 도구막대에서 연다.
// 뷰 세트 카드 = 슬롯 도식 + "바꾸면/지금" 요약(실제 전환과 같은 판정으로 미리 계산),
// 프레이밍 카드 = 선택한 사진의 실제 크롭 미리보기 나란히.

export type ViewSetCardsProps = {
  readonly onChangeViewSet: (viewSet: ViewSetId) => void
  readonly photos: readonly WorkspacePhoto<CanvasImageSource>[]
  readonly spares: readonly WorkspaceSourcePhoto<CanvasImageSource>[]
  readonly viewSet: ViewSet
}

export function ViewSetCards({ onChangeViewSet, photos, spares, viewSet }: ViewSetCardsProps) {
  // 전환 시 실제로 쓰는 순서(배치본 → 예비)와 같게 두어 미리보기와 결과가 어긋나지 않게 한다.
  const sources: readonly WorkspaceSourcePhoto<CanvasImageSource>[] = [...photos, ...spares].map(
    ({ image, pose, sourceSize }) => ({ image, pose, sourceSize }),
  )
  const currentState = currentViewSetState(photos, spares, viewSet)

  return (
    <>
      {/* fieldset+legend가 그룹 이름을, 같은 name의 라디오가 네이티브 라디오 그룹을 만든다. */}
      <fieldset aria-labelledby="protocol-view-set-title" className="setting-cards">
        <legend id="protocol-view-set-title">뷰 세트</legend>
        {VIEW_SET_IDS.map((setId) => {
          const candidate = VIEW_SETS[setId]
          const active = candidate.id === viewSet.id
          const preview = active ? currentState : previewViewSetChange(sources, candidate)
          const effectId = `protocol-view-set-${setId}-effect`
          return (
            <label className={`setting-card${active ? " setting-card--active" : ""}`} key={setId}>
              <input
                aria-describedby={effectId}
                aria-label={candidate.label}
                checked={active}
                name="protocol-view-set"
                onChange={() => {
                  if (!active) {
                    onChangeViewSet(setId)
                  }
                }}
                type="radio"
                value={setId}
              />
              <span className="setting-card__title">
                {candidate.label}
                {active ? <span className="setting-card__badge">사용 중</span> : null}
              </span>
              <span className="setting-card__description">{candidate.description}</span>
              <span aria-hidden="true" className="setting-card__slots">
                {viewSetRows(candidate).map((row) => (
                  <span className="setting-card__slot-row" key={row.join("-")}>
                    {row.map((view) => (
                      <span
                        className={`setting-card__slot${
                          preview.filledViews.includes(view) ? " setting-card__slot--filled" : ""
                        }`}
                        key={view}
                      >
                        {VIEW_LABELS[view]}
                      </span>
                    ))}
                  </span>
                ))}
                {preview.spareCount > 0 ? (
                  <span className="setting-card__slot-row">
                    <span className="setting-card__slot setting-card__slot--spare">
                      예비 {preview.spareCount}장
                    </span>
                  </span>
                ) : null}
              </span>
              <span className="setting-card__effect" id={effectId}>
                {describeViewSetPreview(preview, active ? "current" : "ifSwitched")}
              </span>
            </label>
          )
        })}
      </fieldset>
      <p aria-live="polite" className="setting-cards__status">
        지금 세트: {viewSet.label} — {describeViewSetPreview(currentState, "current")}
      </p>
    </>
  )
}

export type FramingCardsProps = {
  readonly framing: FramingPreset
  readonly onChangeFramingPreset: (preset: FramingPresetId) => void
  // 크롭 미리보기에 쓰는 사진(선택한 사진, 없으면 null).
  readonly previewPhoto: WorkspacePhoto<CanvasImageSource> | null
}

export function FramingCards({ framing, onChangeFramingPreset, previewPhoto }: FramingCardsProps) {
  return (
    <>
      <fieldset
        aria-labelledby="protocol-framing-title"
        className="setting-cards setting-cards--framing"
      >
        <legend id="protocol-framing-title">크롭 프레이밍</legend>
        {FRAMING_PRESET_IDS.map((presetId) => {
          const preset = FRAMING_PRESETS[presetId]
          const active = preset.id === framing.id
          const descriptionId = `protocol-framing-${presetId}-description`
          return (
            <label
              className={`setting-card setting-card--framing${active ? " setting-card--active" : ""}`}
              key={presetId}
            >
              <input
                aria-describedby={descriptionId}
                aria-label={preset.label}
                checked={active}
                name="protocol-framing"
                onChange={() => {
                  if (!active) {
                    onChangeFramingPreset(presetId)
                  }
                }}
                type="radio"
                value={presetId}
              />
              <span className="setting-card__thumb">
                {previewPhoto === null ? (
                  <span className="setting-card__thumb-empty">
                    사진을 정렬하면 여기서 크롭을 미리 봅니다
                  </span>
                ) : (
                  <CropPreview framing={preset} photo={previewPhoto} quality="compact" />
                )}
              </span>
              <span className="setting-card__title">
                {preset.label}
                {active ? <span className="setting-card__badge">사용 중</span> : null}
              </span>
              <span className="setting-card__description" id={descriptionId}>
                {preset.description}
              </span>
            </label>
          )
        })}
      </fieldset>
      {previewPhoto === null ? null : (
        <p className="setting-cards__status">
          미리보기 기준: {VIEW_LABELS[previewPhoto.view]} 사진 · 바꾸면 모든 뷰에 적용됩니다.
        </p>
      )}
    </>
  )
}
