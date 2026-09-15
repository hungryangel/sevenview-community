import { useEffect, useRef } from "react"

import type { CropAlignment } from "./crop-preview"
import { isTypingTarget, rotateByShortcut, shortcutForKey } from "./review-shortcuts"

type ReviewShortcutOptions = {
  readonly enabled: boolean
  readonly onRotate: (rotationDegrees: number) => void
  readonly reviewAlignment: CropAlignment
  readonly rotationDegrees: number
  readonly setReviewAlignment: (alignment: CropAlignment) => void
}

// 문서 수준 keydown/keyup 하나로 검토 단축키를 처리한다. 최신 값은 ref로 읽어 리스너를
// 매 렌더마다 다시 걸지 않는다. 열린 <dialog>가 있으면 단축키는 전부 무시한다.
export function useReviewShortcuts(options: ReviewShortcutOptions): void {
  const latest = useRef(options)
  latest.current = options
  const peeking = useRef(false)

  useEffect(() => {
    if (!options.enabled) {
      return undefined
    }
    const dialogOpen = () => document.querySelector("dialog[open]") !== null
    const stopPeek = () => {
      if (peeking.current) {
        peeking.current = false
        latest.current.setReviewAlignment("aligned")
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcut = shortcutForKey(event)
      if (shortcut === null || isTypingTarget(event.target) || dialogOpen()) {
        return
      }
      event.preventDefault()
      if (shortcut === "peekOriginal") {
        // 누르고 있는 동안만 원본 — 이미 원본 보기 중이면 건드리지 않는다.
        if (!event.repeat && !peeking.current && latest.current.reviewAlignment === "aligned") {
          peeking.current = true
          latest.current.setReviewAlignment("original")
        }
        return
      }
      latest.current.onRotate(rotateByShortcut(latest.current.rotationDegrees, shortcut))
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (shortcutForKey(event) === "peekOriginal") {
        stopPeek()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("keyup", handleKeyUp)
    window.addEventListener("blur", stopPeek)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("blur", stopPeek)
      stopPeek()
    }
  }, [options.enabled])
}
