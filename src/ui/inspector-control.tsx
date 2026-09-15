import { ArrowCounterClockwise, Minus, Plus } from "@phosphor-icons/react"
import { type ChangeEvent, useId } from "react"
import { AdjustmentRange } from "./adjustment-range"

type InspectorControlProps = {
  readonly defaultValue: number
  readonly disabled?: boolean
  readonly error?: string
  readonly formatValue?: (value: number) => string
  readonly hint?: string
  readonly label: string
  readonly max: number
  readonly min: number
  readonly onChange: (value: number) => void
  readonly onReset: () => void
  readonly step: number
  readonly unit: string
  readonly value: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function InspectorControl({
  defaultValue,
  disabled = false,
  error,
  formatValue,
  hint,
  label,
  max,
  min,
  onChange,
  onReset,
  step,
  unit,
  value,
}: InspectorControlProps) {
  const inputId = useId()
  const errorId = useId()
  const changed = value !== defaultValue
  const handleRange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.currentTarget.value))
  }

  return (
    <div
      className={`inspector-control${changed ? " inspector-control--changed" : ""}${error === undefined ? "" : " inspector-control--error"}`}
    >
      <div className="inspector-control__header">
        <label htmlFor={inputId}>{label}</label>
        <output htmlFor={inputId}>{formatValue?.(value) ?? `${value}${unit}`}</output>
      </div>
      <div className="inspector-control__row">
        <button
          aria-label={`${label} 줄이기`}
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - step, min, max))}
          type="button"
        >
          <Minus aria-hidden="true" size={15} />
        </button>
        <AdjustmentRange
          aria-describedby={error === undefined ? undefined : errorId}
          aria-valuetext={`${value}${unit}`}
          disabled={disabled}
          id={inputId}
          max={max}
          min={min}
          onChange={handleRange}
          step={step}
          value={value}
        />
        <button
          aria-label={`${label} 늘리기`}
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + step, min, max))}
          type="button"
        >
          <Plus aria-hidden="true" size={15} />
        </button>
        <button
          aria-label={`${label} 기본값으로 재설정`}
          className="inspector-control__reset"
          disabled={disabled || !changed}
          onClick={onReset}
          type="button"
        >
          <ArrowCounterClockwise aria-hidden="true" size={15} />
        </button>
      </div>
      {hint === undefined ? null : <small className="inspector-control__hint">{hint}</small>}
      {error === undefined ? null : (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
