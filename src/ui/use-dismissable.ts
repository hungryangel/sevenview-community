import { type RefObject, useEffect } from "react"

export type DismissReason = "escape" | "pointer"

// 팝오버 공통 규칙: 컨테이너 바깥 pointerdown 또는 Escape로 닫는다.
export function useDismissable(
  active: boolean,
  onDismiss: (reason: DismissReason) => void,
  containerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!active) {
      return undefined
    }
    const handlePointerDown = (event: PointerEvent) => {
      const container = containerRef.current
      if (container !== null && event.target instanceof Node && !container.contains(event.target)) {
        onDismiss("pointer")
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss("escape")
      }
    }
    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [active, onDismiss, containerRef])
}
