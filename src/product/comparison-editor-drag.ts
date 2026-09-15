import { type PointerEvent, useCallback, useEffect, useRef } from "react"

type PointerPosition = Pick<globalThis.PointerEvent, "clientX" | "clientY">

export function useComparisonEditorDrag(enabled: boolean) {
  const cleanup = useRef<(() => void) | null>(null)
  const cancel = useCallback(() => {
    const finish = cleanup.current
    cleanup.current = null
    finish?.()
  }, [])
  useEffect(() => {
    if (!enabled) cancel()
    return cancel
  }, [cancel, enabled])

  const start = (event: PointerEvent<HTMLElement>, move: (point: PointerPosition) => void) => {
    if (!enabled || event.button !== 0) return
    cancel()
    event.preventDefault()
    const target = event.currentTarget
    const pointerId = event.pointerId
    target.setPointerCapture?.(pointerId)
    const update = (next: globalThis.PointerEvent) => {
      if (next.pointerId === pointerId) move(next)
    }
    const finish = (next: globalThis.PointerEvent) => {
      if (next.pointerId !== pointerId) return
      update(next)
      cancel()
    }
    const abort = (next: globalThis.PointerEvent) => {
      if (next.pointerId === pointerId) cancel()
    }
    window.addEventListener("pointermove", update)
    window.addEventListener("pointerup", finish)
    window.addEventListener("pointercancel", abort)
    window.addEventListener("blur", cancel)
    document.addEventListener("visibilitychange", cancel)
    cleanup.current = () => {
      window.removeEventListener("pointermove", update)
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", abort)
      window.removeEventListener("blur", cancel)
      document.removeEventListener("visibilitychange", cancel)
      if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId)
    }
  }
  return { cancel, start }
}
