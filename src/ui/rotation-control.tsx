import { ArrowClockwise, ArrowCounterClockwise } from "@phosphor-icons/react"
import { type ChangeEvent, useId } from "react"
import { AdjustmentRange } from "./adjustment-range"

type RotationControlProps = {
  readonly max: number
  readonly min: number
  readonly onChange: (value: number) => void
  readonly onReset: () => void
  readonly value: number
}

// 2026-09-03 bee: 0.5° 단위는 거칠다 — 미세 조정·슬라이더·단축키 모두 0.1° 단위로.
const COARSE_STEP = 1
export const ROTATION_FINE_STEP_DEGREES = 0.1

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// 0.1 단위 부동소수 오차(0.1+0.2=0.30000000000000004)를 표시·비교 전에 정리한다.
function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10
}

export function RotationControl({ max, min, onChange, onReset, value }: RotationControlProps) {
  const inputId = useId()
  const changed = value !== 0
  const changeBy = (delta: number) => onChange(clamp(roundToTenth(value + delta), min, max))
  const handleRange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(roundToTenth(Number(event.currentTarget.value)))
  }

  return (
    <section
      className={`rotation-control${changed ? " rotation-control--changed" : ""}`}
      data-level={!changed}
    >
      <div className="rotation-control__header">
        <label htmlFor={inputId}>수평 회전</label>
        <button
          aria-label="수평 회전 기본값으로 재설정"
          disabled={!changed}
          onClick={onReset}
          type="button"
        >
          기본값 재설정
        </button>
      </div>
      <div className="rotation-control__coarse">
        <button
          aria-label="수평 회전 반시계 방향 1°"
          disabled={value <= min}
          onClick={() => changeBy(-COARSE_STEP)}
          type="button"
        >
          <ArrowCounterClockwise aria-hidden="true" size={20} />
        </button>
        {/* key로 값이 바뀔 때마다 다시 마운트 → 한 번 반짝이는 애니메이션이 재생된다. */}
        <output aria-live="polite" key={value.toFixed(1)}>
          {value.toFixed(1)}°
        </output>
        <button
          aria-label="수평 회전 시계 방향 1°"
          disabled={value >= max}
          onClick={() => changeBy(COARSE_STEP)}
          type="button"
        >
          <ArrowClockwise aria-hidden="true" size={20} />
        </button>
      </div>
      <div className="rotation-control__fine">
        <span>미세 조정</span>
        <div>
          <button
            aria-label="수평 회전 미세 조정 -0.1°"
            disabled={value <= min}
            onClick={() => changeBy(-ROTATION_FINE_STEP_DEGREES)}
            type="button"
          >
            −0.1°
          </button>
          <button
            aria-label="수평 회전 미세 조정 +0.1°"
            disabled={value >= max}
            onClick={() => changeBy(ROTATION_FINE_STEP_DEGREES)}
            type="button"
          >
            +0.1°
          </button>
        </div>
      </div>
      <div className="rotation-control__track">
        <AdjustmentRange
          aria-valuetext={`${value.toFixed(1)}°`}
          id={inputId}
          max={max}
          min={min}
          onChange={handleRange}
          step={ROTATION_FINE_STEP_DEGREES}
          value={value}
        />
        {/* 계측기 눈금: 양끝과 0°(수평 기준). 값이 0°면 위 readout이 기준 색으로 바뀐다. */}
        <div aria-hidden="true" className="rotation-control__scale">
          <span>{min}°</span>
          <span>0°</span>
          <span>+{max}°</span>
        </div>
      </div>
    </section>
  )
}
