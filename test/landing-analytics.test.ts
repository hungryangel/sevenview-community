import { describe, expect, it } from "vitest"
import { isAnalyticsPage } from "../src/community/landing-analytics"

describe("introduction-only analytics boundary", () => {
  it("allows only the clean official introduction URL", () => {
    expect(isAnalyticsPage(new URL("https://sevenview.velnoc.com/"))).toBe(true)
  })
  it.each([
    "https://sevenview.velnoc.com/app",
    "http://sevenview.velnoc.com/",
    "https://sevenview.velnoc.com/app/",
    "https://sevenview.velnoc.com/?patient=example",
    "https://sevenview.velnoc.com/#example",
    "https://sevenview-community.pages.dev/",
    "https://sevenview.velnoc.com.other.example/",
    "http://localhost:4384/",
  ])("does not track %s", (url) => {
    expect(isAnalyticsPage(new URL(url))).toBe(false)
  })
})
