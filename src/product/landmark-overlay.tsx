import type { Point, RegistrationAnchors } from "../domain/types"

type LandmarkOverlayProps = {
  readonly anchors?: RegistrationAnchors | null
  readonly normalizedPoints?: readonly Point[]
}

export function LandmarkOverlay({ anchors, normalizedPoints }: LandmarkOverlayProps) {
  if (anchors === null && normalizedPoints === undefined)
    return <span className="analysis-landmarks__missing">감지 기준점 없음</span>
  const points = normalizedPoints ?? [
    ...(anchors === undefined || anchors === null
      ? []
      : [anchors.screenLeftEye, anchors.screenRightEye, anchors.noseTip]),
  ]
  return (
    <span aria-label="실제 감지 기준점" className="analysis-landmarks" role="img">
      {points.map((point, index) => (
        <span
          aria-hidden="true"
          className="analysis-landmarks__point"
          key={`${point.x}-${point.y}`}
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
        >
          {index + 1}
        </span>
      ))}
    </span>
  )
}
