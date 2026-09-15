import { afterEach, describe, expect, it, vi } from "vitest"

import {
  assertModelIntegrity,
  fetchVerifiedModel,
  ModelFetchError,
  ModelIntegrityError,
  sha256Hex,
} from "../src/adapters/model-integrity"

// "abc"의 SHA-256 — FIPS 180-4 검증 벡터.
const ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
const abc = () => new TextEncoder().encode("abc")

describe("model integrity", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("hashes bytes with SHA-256 as lowercase hex", async () => {
    expect(await sha256Hex(abc())).toBe(ABC_SHA256)
  })

  it("returns the bytes untouched when the pinned hash matches (case-insensitive)", async () => {
    const bytes = abc()
    expect(await assertModelIntegrity(bytes, ABC_SHA256.toUpperCase(), "probe")).toBe(bytes)
  })

  it("refuses a model whose bytes do not match the pinned hash", async () => {
    await expect(
      assertModelIntegrity(new TextEncoder().encode("abd"), ABC_SHA256, "probe"),
    ).rejects.toBeInstanceOf(ModelIntegrityError)
  })

  it("fetches, verifies, and fails closed on HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("missing.task")
          ? new Response(null, { status: 404 })
          : new Response(abc(), { status: 200 }),
      ),
    )

    expect(await fetchVerifiedModel("/models/ok.task", ABC_SHA256, "ok")).toEqual(abc())
    await expect(
      fetchVerifiedModel("/models/missing.task", ABC_SHA256, "missing"),
    ).rejects.toBeInstanceOf(ModelFetchError)
    await expect(
      fetchVerifiedModel("/models/ok.task", "00".repeat(32), "swapped"),
    ).rejects.toBeInstanceOf(ModelIntegrityError)
  })
})
