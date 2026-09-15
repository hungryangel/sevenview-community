import { COMPARISON_ANGLES, type ComparisonAngle } from "../domain/comparison"
import type { ComparisonAngleResolution } from "../domain/comparison-angle"
import { ANGLE_LABELS } from "./comparison-viewer"

type Props = {
  readonly resolution?: ComparisonAngleResolution | null
  readonly override?: ComparisonAngle | null
  readonly disabled: boolean
  readonly onChange: (angle: ComparisonAngle | null) => void
}

export function ComparisonAngleControl({ resolution, override, disabled, onChange }: Props) {
  if (resolution == null)
    return <p className="comparison-angle__hint">사진을 넣으면 촬영 방향을 자동으로 확인합니다.</p>
  const label = (angle: ComparisonAngle | null) =>
    angle === null ? "확인 불가" : ANGLE_LABELS[angle]
  const selection = (
    <label>
      촬영 방향 직접 확인
      <select
        disabled={disabled}
        onChange={(event) => {
          if (event.currentTarget.value === "automatic") {
            onChange(null)
            return
          }
          const angle = COMPARISON_ANGLES.find((item) => item === event.currentTarget.value)
          if (angle !== undefined) onChange(angle)
        }}
        value={override ?? "automatic"}
      >
        <option value="automatic">자동 판단 사용</option>
        {COMPARISON_ANGLES.map((angle) => (
          <option key={angle} value={angle}>
            {ANGLE_LABELS[angle]}
          </option>
        ))}
      </select>
    </label>
  )
  return (
    <section className="comparison-angle" aria-label="촬영 방향 확인">
      <p>
        자동 감지 · 시술 전 {label(resolution.before)} · 시술 후 {label(resolution.after)}
      </p>
      {resolution.kind === "reviewRequired" ? (
        <>
          <p role="status">
            {resolution.reason === "manual_direction_required"
              ? "자동 감지가 어려운 사진입니다. 두 사진의 촬영 방향을 직접 확인한 뒤 기준점을 지정해 주세요."
              : resolution.reason === "angle_mismatch"
                ? "두 사진의 촬영 방향이 다르게 감지되었습니다. 같은 방향의 사진인지 확인하거나 교체해 주세요."
                : "촬영 방향을 확인할 수 없습니다. 사진을 교체하거나 다시 분석해 주세요."}
          </p>
          {resolution.reason !== "invalid_pose" ? selection : null}
        </>
      ) : (
        <details>
          <summary>
            {resolution.provenance === "manual"
              ? "직접 확인한 방향 사용 중"
              : "감지한 방향이 다른가요?"}
          </summary>
          {selection}
        </details>
      )}
      <p className="comparison-angle__hint">
        좌·우는 코가 화면에서 향하는 방향입니다. 방향 선택은 사진을 45° 회전시키지 않습니다.
      </p>
    </section>
  )
}
