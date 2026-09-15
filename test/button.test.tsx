// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Button } from "../src/ui/button"

afterEach(cleanup)

describe("Button", () => {
  // 2026-09-01 실측 결함 회귀 방지: 하이픈 속성은 tsc가 검사하지 않으므로
  // DOM 도달 여부를 직접 고정한다.
  it("forwards aria state and label props to the DOM button", () => {
    render(
      <Button aria-label="미리보기 축소" aria-pressed onClick={() => undefined} variant="quiet">
        −
      </Button>,
    )

    const button = screen.getByRole("button", { name: "미리보기 축소" })
    expect(button.getAttribute("aria-pressed")).toBe("true")
  })

  it("stays busy and non-interactive while loading", () => {
    render(<Button loading>PNG 내보내기</Button>)

    const button = screen.getByRole("button") as HTMLButtonElement
    expect(button.getAttribute("aria-busy")).toBe("true")
    expect(button.disabled).toBe(true)
  })
})
