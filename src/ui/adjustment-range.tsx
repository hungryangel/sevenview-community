import { type ComponentProps, type CSSProperties, useEffect, useRef, useState } from "react"

type AdjustmentRangeProps = Omit<ComponentProps<"input">, "type" | "min" | "max" | "value"> & {
  readonly min: number
  readonly max: number
  readonly value: number
}

export function AdjustmentRange({ min, max, value, ...props }: AdjustmentRangeProps) {
  const pointerOrigin = useRef(false)
  const [pointerActive, setPointerActive] = useState(false)
  const [keyboardFocus, setKeyboardFocus] = useState(false)
  useEffect(() => {
    if (!pointerActive) return
    const release = () => setPointerActive(false)
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", release)
    return () => {
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
    }
  }, [pointerActive])
  const style: CSSProperties & { readonly "--range-progress": string } = {
    "--range-progress": `${((value - min) / (max - min)) * 100}%`,
  }
  return (
    <input
      {...props}
      className="adjustment-range"
      data-adjusting={pointerActive || keyboardFocus}
      min={min}
      max={max}
      onBlur={() => {
        pointerOrigin.current = false
        setPointerActive(false)
        setKeyboardFocus(false)
      }}
      onFocus={() => setKeyboardFocus(!pointerOrigin.current)}
      onKeyDown={() => {
        pointerOrigin.current = false
        setKeyboardFocus(true)
      }}
      onPointerDown={() => {
        pointerOrigin.current = true
        setKeyboardFocus(false)
        setPointerActive(true)
      }}
      onPointerUp={() => setPointerActive(false)}
      onPointerCancel={() => setPointerActive(false)}
      style={style}
      type="range"
      value={value}
    />
  )
}
