import { describe, expect, it } from "vitest"

import { buildContentSecurityPolicy } from "../build/content-security-policy"

describe("production Content-Security-Policy", () => {
  it("keeps the community build closed to every external connection", () => {
    const policy = buildContentSecurityPolicy()

    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("connect-src 'self';")
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).not.toContain("velnoc")
    // eval은 열지 않는다 — WASM 인스턴스화만 허용한다.
    expect(policy).not.toContain("'unsafe-eval'")
  })

})
