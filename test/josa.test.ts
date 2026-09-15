import { describe, expect, it } from "vitest"

import { joinGwaWa } from "../src/domain/josa"

describe("joinGwaWa", () => {
  it("uses 과 after a final consonant and 와 otherwise", () => {
    expect(joinGwaWa("정면")).toBe("정면과")
    expect(joinGwaWa("우측 45도")).toBe("우측 45도와")
    expect(joinGwaWa("좌측 45도")).toBe("좌측 45도와")
    expect(joinGwaWa("우측 측면")).toBe("우측 측면과")
    expect(joinGwaWa("좌측 측면")).toBe("좌측 측면과")
  })

  it("ignores non-Hangul tails like closing parentheses", () => {
    expect(joinGwaWa("아래 (턱 밑)")).toBe("아래 (턱 밑)과")
    expect(joinGwaWa("위 (정수리)")).toBe("위 (정수리)와")
  })

  it("falls back to 와 when no Hangul is present", () => {
    expect(joinGwaWa("A1")).toBe("A1와")
  })
})
