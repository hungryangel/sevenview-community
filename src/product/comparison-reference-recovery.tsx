import { useEffect, useState } from "react"

import type { ComparisonSide } from "../domain/comparison"
import type { RegistrationReferences } from "../domain/comparison-registration"
import type { ImageSize } from "../domain/types"
import { Button } from "../ui/button"

const SIDE_LABEL = { after: "시술 후", before: "시술 전" } as const

export function ComparisonReferenceRecovery({
  disabled = false,
  file,
  onChange,
  side,
  sourceSize,
}: {
  readonly disabled?: boolean
  readonly file: File | null
  readonly onChange: (references: RegistrationReferences) => void
  readonly side: ComparisonSide
  readonly sourceSize: ImageSize
}) {
  const [url, setUrl] = useState("")
  const [selected, setSelected] = useState<"first" | "second">("first")
  const [cursor, setCursor] = useState({ x: 0.5, y: 0.5 })
  const [values, setValues] = useState({ first: { x: "", y: "" }, second: { x: "", y: "" } })
  useEffect(() => {
    if (file === null) return undefined
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  const commit = () => {
    const numbers = {
      first: { x: Number(values.first.x), y: Number(values.first.y) },
      second: { x: Number(values.second.x), y: Number(values.second.y) },
    }
    if (valid) onChange(numbers)
  }
  const valid = Object.values(values).every((point) =>
    Object.values(point).every(
      (value) =>
        value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1,
    ),
  )
  const pointLabel = (point: "first" | "second") => (point === "first" ? "기준점 1" : "기준점 2")
  return (
    <fieldset className="comparison-reference-editor__required">
      <legend>기준점 확인 필요 · {SIDE_LABEL[side]}</legend>
      <p>
        자동 정렬을 대신하는 수동 정렬입니다. 두 사진에서 같은 위치를 가리키는 점 두 개를 순서대로
        찍어주세요. 가려진 눈 대신 직접 확인할 수 있는 부위를 고르세요.
      </p>
      <p className="comparison-angle__hint">
        키보드: 방향키로 십자선을 이동하고 Enter로 점을 놓습니다. Shift와 함께 누르면 크게
        이동합니다.
      </p>
      <div className="comparison-reference-editor__recovery-selectors">
        <Button
          aria-pressed={selected === "first"}
          disabled={disabled}
          onClick={() => setSelected("first")}
          variant="secondary"
        >
          {pointLabel("first")} 선택
        </Button>
        <Button
          aria-pressed={selected === "second"}
          disabled={disabled}
          onClick={() => setSelected("second")}
          variant="secondary"
        >
          {pointLabel("second")} 선택
        </Button>
      </div>
      <button
        aria-label={`${SIDE_LABEL[side]} 원본에서 ${pointLabel(selected)} 놓기`}
        className="comparison-reference-editor__recovery-image"
        disabled={disabled}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.05 : 0.005
          const movements: Readonly<Record<string, readonly [number, number]>> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
          }
          const movement = movements[event.key]
          if (movement === undefined) return
          event.preventDefault()
          setCursor((current) => ({
            x: Math.min(1, Math.max(0, current.x + movement[0])),
            y: Math.min(1, Math.max(0, current.y + movement[1])),
          }))
        }}
        onClick={(event) => {
          if (event.detail !== 0) return
          setValues((current) => ({
            ...current,
            [selected]: { x: cursor.x.toFixed(3), y: cursor.y.toFixed(3) },
          }))
          setSelected(selected === "first" ? "second" : "first")
        }}
        onPointerDown={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          setValues((current) => ({
            ...current,
            [selected]: {
              x: String(Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))),
              y: String(Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height))),
            },
          }))
          setSelected(selected === "first" ? "second" : "first")
        }}
        style={{
          aspectRatio: `${sourceSize.width} / ${sourceSize.height}`,
          backgroundImage: url === "" ? undefined : `url(${url})`,
        }}
        type="button"
      >
        <span
          aria-hidden="true"
          className="comparison-reference-editor__crosshair"
          style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
        >
          +
        </span>
        {(["first", "second"] as const).map((point, index) =>
          values[point].x === "" || values[point].y === "" ? null : (
            <span
              aria-hidden="true"
              className="comparison-reference-editor__marker"
              key={point}
              style={{
                left: `${Number(values[point].x) * 100}%`,
                top: `${Number(values[point].y) * 100}%`,
              }}
            >
              {index + 1}
            </span>
          ),
        )}
      </button>
      <details className="comparison-reference-editor__coordinates">
        <summary>좌표로 정밀 입력</summary>
        {(["first", "second"] as const).map((pointName) =>
          (["x", "y"] as const).map((axis) => (
            <label key={`${pointName}-${axis}`}>
              {pointLabel(pointName)} {axis.toUpperCase()}
              <input
                disabled={disabled}
                max="1"
                min="0"
                step="0.001"
                type="number"
                value={values[pointName][axis]}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [pointName]: {
                      ...current[pointName],
                      [axis]: event.target.value,
                    },
                  }))
                }
              />
            </label>
          )),
        )}
      </details>
      <Button disabled={disabled || !valid} onClick={commit} variant="primary">
        기준점 적용
      </Button>
    </fieldset>
  )
}
