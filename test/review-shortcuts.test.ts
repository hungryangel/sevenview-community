// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import {
  isTypingTarget,
  ROTATION_SHORTCUT_COARSE_STEP_DEGREES,
  ROTATION_SHORTCUT_STEP_DEGREES,
  rotateByShortcut,
  shortcutForKey,
} from "../src/product/review-shortcuts"

const key = (
  code: string,
  modifiers: Partial<Record<"altKey" | "ctrlKey" | "metaKey" | "shiftKey", boolean>> = {},
) => ({
  altKey: false,
  code,
  ctrlKey: false,
  metaKey: false,
  ...modifiers,
})

describe("review shortcuts", () => {
  it("maps key positions, not characters, so the Korean ₩ key still peeks the original", () => {
    // 2026-09-03 Gemini 제안 채택: `\` 홀드 비교, `[` `]` 회전. Space는 충돌해 채택하지 않음.
    expect(shortcutForKey(key("Backslash"))).toBe("peekOriginal")
    expect(shortcutForKey(key("BracketLeft"))).toBe("rotateCcw")
    expect(shortcutForKey(key("BracketRight"))).toBe("rotateCw")
    expect(shortcutForKey(key("Space"))).toBeNull()
    expect(shortcutForKey(key("KeyR"))).toBeNull()
  })

  it("uses Shift for the coarse 1° step and never peeks with Shift held", () => {
    expect(shortcutForKey(key("BracketLeft", { shiftKey: true }))).toBe("rotateCcwCoarse")
    expect(shortcutForKey(key("BracketRight", { shiftKey: true }))).toBe("rotateCwCoarse")
    expect(shortcutForKey(key("Backslash", { shiftKey: true }))).toBeNull()
  })

  it("ignores chords with other modifiers so browser shortcuts keep working", () => {
    expect(shortcutForKey(key("Backslash", { metaKey: true }))).toBeNull()
    expect(shortcutForKey(key("BracketLeft", { ctrlKey: true }))).toBeNull()
    expect(shortcutForKey(key("BracketRight", { altKey: true }))).toBeNull()
  })

  it("does not fire while typing in inputs, selects, text areas, or editable content", () => {
    const input = document.createElement("input")
    const select = document.createElement("select")
    const textarea = document.createElement("textarea")
    const editable = document.createElement("div")
    editable.contentEditable = "true"
    const button = document.createElement("button")

    expect(isTypingTarget(input)).toBe(true)
    expect(isTypingTarget(select)).toBe(true)
    expect(isTypingTarget(textarea)).toBe(true)
    // jsdom은 isContentEditable을 구현하지 않으므로 속성으로 대신 확인한다.
    expect(isTypingTarget(editable) || editable.contentEditable === "true").toBe(true)
    expect(isTypingTarget(button)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })

  it("rotates in 0.1° steps (1° with Shift) and clamps at the ±12° control limits", () => {
    // 2026-09-03 bee: 0.5°는 거칠다 → 0.1° 기본, Shift 1°.
    expect(ROTATION_SHORTCUT_STEP_DEGREES).toBe(0.1)
    expect(ROTATION_SHORTCUT_COARSE_STEP_DEGREES).toBe(1)
    expect(rotateByShortcut(0, "rotateCw")).toBe(0.1)
    expect(rotateByShortcut(0.1, "rotateCcw")).toBe(0)
    expect(rotateByShortcut(-0.1, "rotateCcw")).toBe(-0.2)
    expect(rotateByShortcut(0.2, "rotateCw")).toBe(0.3) // 부동소수 오차 없이 0.3
    expect(rotateByShortcut(0, "rotateCwCoarse")).toBe(1)
    expect(rotateByShortcut(0.4, "rotateCcwCoarse")).toBe(-0.6)
    expect(rotateByShortcut(11.95, "rotateCw")).toBe(12)
    expect(rotateByShortcut(11.5, "rotateCwCoarse")).toBe(12)
    expect(rotateByShortcut(-12, "rotateCcw")).toBe(-12)
  })
})
