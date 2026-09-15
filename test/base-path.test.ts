import { describe, expect, it } from "vitest"

import { normalizeBasePath } from "../build/base-path"

describe("normalizeBasePath", () => {
  it("uses the root path when a static deployment path is not supplied", () => {
    // Given: the local development and CI build environment.

    // When: no public base path is configured.
    const basePath = normalizeBasePath(undefined)

    // Then: Vite emits root-relative local paths.
    expect(basePath).toBe("/")
  })

  it("preserves a repository-scoped GitHub Pages path", () => {
    // Given: the repository path supplied by the Pages build workflow.

    // When: the production public base path is normalized.
    const basePath = normalizeBasePath("/sevenview/")

    // Then: every Vite asset can resolve below the Pages repository path.
    expect(basePath).toBe("/sevenview/")
  })

  it("rejects a path that would break relative static assets", () => {
    // Given: a path missing the required trailing slash.

    // When/Then: the build configuration fails instead of silently emitting bad URLs.
    expect(() => normalizeBasePath("/sevenview")).toThrow("leading and trailing slash")
  })
})
