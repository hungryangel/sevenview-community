import { useId } from "react"
import type { AnalysisJourney } from "../domain/analysis-journey"
import { LandmarkOverlay } from "./landmark-overlay"

function containedPoints(
  anchors: NonNullable<AnalysisJourney["items"][number]["anchors"]>,
  sourceSize: NonNullable<AnalysisJourney["items"][number]["sourceSize"]>,
) {
  const sourceAspect = sourceSize.width / sourceSize.height
  const targetAspect = 4 / 5
  const width = sourceAspect > targetAspect ? 1 : sourceAspect / targetAspect
  const height = sourceAspect > targetAspect ? targetAspect / sourceAspect : 1
  const left = (1 - width) / 2
  const top = (1 - height) / 2
  return [anchors.screenLeftEye, anchors.screenRightEye, anchors.noseTip].map((point) => ({
    x: left + point.x * width,
    y: top + point.y * height,
  }))
}

type AnalysisStageFile = {
  readonly previewUrl: string
}

type AnalysisStageProps = {
  readonly active: boolean
  readonly files: readonly AnalysisStageFile[]
  readonly journey: AnalysisJourney
  readonly onCancel: () => void
}

export function AnalysisStage({ active, files, journey, onCancel }: AnalysisStageProps) {
  const titleId = useId()
  const completedItems =
    journey.kind === "detecting" ? journey.completedItems : journey.items.length
  const detectedItems = journey.items.filter((item) => item.anchors !== null).length
  return (
    <section aria-labelledby={titleId} className="analysis-stage">
      <div className="analysis-stage__heading">
        <div>
          <span className="eyebrow">로컬 분석</span>
          <h2 id={titleId}>원본을 보면서 기준점을 찾고 있습니다</h2>
        </div>
        <button className="button button--quiet" onClick={onCancel} type="button">
          분석 취소
        </button>
      </div>
      <p
        aria-live={active && !document.hidden ? "polite" : "off"}
        className="analysis-stage__status"
        role="status"
      >
        {completedItems === 0
          ? `원본 ${journey.totalItems}장을 준비했습니다`
          : `${journey.totalItems}장 중 ${completedItems}장 분석 · 실제 기준점 ${detectedItems}장`}
      </p>
      <ol aria-label="분석 중인 원본 사진" className="analysis-stage__originals">
        {files.map((file, index) => {
          const item = journey.items.find((candidate) => candidate.index === index)
          return (
            <li key={file.previewUrl}>
              <span className="analysis-stage__image">
                <img alt={`${index + 1}번 분석 원본`} src={file.previewUrl} />
                {item === undefined ? null : (
                  <LandmarkOverlay
                    anchors={item.anchors}
                    {...(item.anchors === null || item.sourceSize === undefined
                      ? {}
                      : { normalizedPoints: containedPoints(item.anchors, item.sourceSize) })}
                  />
                )}
              </span>
              <span>{index + 1}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
