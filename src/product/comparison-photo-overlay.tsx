import type { ComparisonAngle, ComparisonSide } from "../domain/comparison"
import {
  type ComparisonPhotoInformationMode,
  comparisonPhotoInformation,
} from "./comparison-photo-information"
import type { ComparisonRenderSide } from "./comparison-render-model"

export function ComparisonPhotoOverlay({
  angle,
  mode,
  render,
  side,
}: {
  readonly angle: ComparisonAngle
  readonly mode: ComparisonPhotoInformationMode
  readonly render: ComparisonRenderSide
  readonly side: ComparisonSide
}) {
  const information = comparisonPhotoInformation(render, mode, angle)
  if (information.kind === "off" || information.kind === "unavailable") return null
  return (
    <svg
      aria-hidden="true"
      className={`comparison-photo-overlay comparison-photo-overlay--${side}`}
      preserveAspectRatio="none"
      viewBox="0 0 1 1"
    >
      {information.kind === "landmarks" ? (
        <g className="comparison-photo-overlay__mesh">
          {information.points.map((point) => (
            <circle key={point.id} cx={point.x} cy={point.y} r="0.0025" />
          ))}
          {information.named.map((point, index) => (
            <g className="comparison-photo-overlay__named" key={point.label}>
              <circle cx={point.x} cy={point.y} r="0.01" />
              <text fontSize="0.025" x={point.x + 0.014} y={point.y}>
                {index + 1}
              </text>
            </g>
          ))}
        </g>
      ) : information.kind === "registration" ? (
        information.points.map((point, index) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="0.009" />
            <text fontSize="0.022" x={point.x + 0.017} y={point.y}>
              {index + 1}
            </text>
          </g>
        ))
      ) : (
        <g className="comparison-photo-overlay__face-region">
          <polygon points={information.polygon.map(({ x, y }) => `${x},${y}`).join(" ")} />
          <circle cx={information.anchor.x} cy={information.anchor.y} r="0.018" />
        </g>
      )}
    </svg>
  )
}
