import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// 팔레트 계약(DESIGN.md §2·§8): 토큰을 바꿔도 WCAG AA 쌍이 깨지지 않게 실제 값으로 고정한다.
// 2026-09-03 개정(딥 네이비틸 + 시안 accent)에서 처음 도입.
const tokensCss = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8")

function token(name: string): string {
  const match = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (match?.[1] === undefined) {
    throw new Error(`token --${name} is not a hex color in tokens.css`)
  }
  return match[1]
}

function luminance(hex: string): number {
  const channel = (index: number) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)
}

describe("design tokens keep WCAG AA pairs", () => {
  const panel = token("surface-panel")
  const raised = token("surface-raised")
  const hover = token("surface-hover")

  it("keeps text readable on every surface it sits on (≥ 4.5:1)", () => {
    for (const surface of [token("surface-canvas"), panel, raised]) {
      expect(contrast(token("text-primary"), surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(token("text-secondary"), surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(token("text-muted"), surface)).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(token("text-secondary"), hover)).toBeGreaterThanOrEqual(4.5)
  })

  it("keeps control borders and the focus ring visible (≥ 3:1)", () => {
    for (const surface of [token("surface-canvas"), panel, raised]) {
      expect(contrast(token("border-standard"), surface)).toBeGreaterThanOrEqual(3)
      expect(contrast(token("focus-ring"), surface)).toBeGreaterThanOrEqual(3)
    }
  })

  it("keeps accent usable both as text on panels and as a fill under accent-ink", () => {
    expect(contrast(token("accent-primary"), panel)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token("accent-hover"), raised)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token("accent-ink"), token("accent-primary"))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token("accent-ink"), token("accent-hover"))).toBeGreaterThanOrEqual(4.5)
  })

  it("keeps status colors legible on panels (≥ 4.5:1)", () => {
    for (const name of ["status-success", "status-warning", "status-error"]) {
      expect(contrast(token(name), panel)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("keeps comparison point numbers readable on every guide color (≥ 4.5:1)", () => {
    const overlayCss = readFileSync(
      new URL("../src/styles/comparison-workspace.css", import.meta.url),
      "utf8",
    )
    const guideCss = readFileSync(
      new URL("../src/styles/product-components.css", import.meta.url),
      "utf8",
    )
    const fill = overlayCss.match(
      /\.comparison-photo-overlay text\s*\{[^}]*fill:\s*var\(--([\w-]+)\)/,
    )?.[1]
    if (fill === undefined) throw new Error("Comparison point number fill token is missing")
    const guideColors = [...guideCss.matchAll(/--guide-color:\s*(#[\da-f]{6})/gi)]
    expect(guideColors).toHaveLength(5)
    for (const match of guideColors) {
      const color = match[1]
      if (color === undefined) throw new Error("Guide color is missing")
      expect(contrast(token(fill), color)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("keeps the photo well neutral (no color cast) and the export sheet unchanged", () => {
    const [r, g, b] = [1, 3, 5].map((index) =>
      Number.parseInt(token("surface-image").slice(index, index + 2), 16),
    )
    expect(Math.max(r ?? 0, g ?? 0, b ?? 0) - Math.min(r ?? 0, g ?? 0, b ?? 0)).toBeLessThanOrEqual(
      4,
    )
    expect(token("export-sheet-background")).toBe("#f4f4f2")
  })
})
