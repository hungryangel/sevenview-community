// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { GUIDE_SEQUENCE, GuideDialog } from "../src/product/guide-dialog"

afterEach(cleanup)

describe("GuideDialog", () => {
  it("opens the local-processing guide and switches to all seven shooting views", () => {
    render(<GuideDialog onClose={() => undefined} open />)
    expect(screen.getByRole("dialog", { name: "가이드" })).toBeTruthy()
    expect(screen.getByText("로컬 처리")).toBeTruthy()
    fireEvent.click(screen.getByRole("tab", { name: "촬영 가이드" }))
    expect(GUIDE_SEQUENCE).toHaveLength(7)
    expect(screen.getByText(GUIDE_SEQUENCE[6])).toBeTruthy()
  })

  it("renders nothing while closed", () => {
    const { container } = render(<GuideDialog onClose={() => undefined} open={false} />)
    expect(container.textContent).toBe("")
  })
})
