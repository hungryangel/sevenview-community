import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { execFile } from "node:child_process"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { promisify } from "node:util"
import { afterEach, describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)
const verifier = resolve("scripts/verify-community-release.mjs")

type GuardFailure = {
  readonly code: number
  readonly stdout: string
}

async function rejectedGuard(cwd: string, env = process.env): Promise<GuardFailure> {
  try {
    await execFileAsync(process.execPath, [verifier], { cwd, env })
    throw new Error("Publication guard unexpectedly accepted the adversarial fixture")
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      "stdout" in error &&
      typeof error.code === "number" &&
      typeof error.stdout === "string"
    ) {
      return { code: error.code, stdout: error.stdout }
    }
    throw error
  }
}

const fixtures: string[] = []
afterEach(async () => Promise.all(fixtures.splice(0).map((path) => rm(path, { force: true, recursive: true }))))

describe("Community publication boundary", () => {
  it("rejects a forbidden source family and payload", async () => {
    const fixture = await mkdtemp(join(tmpdir(), "sevenview-community-guard-"))
    fixtures.push(fixture)
    await writeFile(
      join(fixture, ["change", "measurement"].join("-") + ".ts"),
      ["sevenview", "change", "measurement", "report", "v1"].join("."),
    )
    const failure = await rejectedGuard(fixture)
    expect(failure).toMatchObject({ code: 1 })
    expect(failure.stdout).toContain('"code": "forbidden-family"')
    expect(failure.stdout).toContain('"code": "forbidden-payload"')
  })

  it("rejects secret-shaped text and an unapproved binary", async () => {
    const fixture = await mkdtemp(join(tmpdir(), "sevenview-community-guard-"))
    fixtures.push(fixture)
    await writeFile(join(fixture, "notes.txt"), ["-----BEGIN", "PRIVATE KEY-----"].join(" "))
    await writeFile(join(fixture, "unknown.bin"), Buffer.from([0, 1, 2]))
    const failure = await rejectedGuard(fixture)
    expect(failure).toMatchObject({ code: 1 })
    expect(failure.stdout).toContain('"code": "secret-shaped-content"')
    expect(failure.stdout).toContain('"code": "unapproved-binary"')
  })

  it("rejects an external symlink", async () => {
    const fixture = await mkdtemp(join(tmpdir(), "sevenview-community-guard-"))
    fixtures.push(fixture)
    await symlink("/tmp", join(fixture, "outside"))
    const failure = await rejectedGuard(fixture)
    expect(failure).toMatchObject({ code: 1 })
    expect(failure.stdout).toContain('"code": "external-symlink"')
  })

  it("rejects a nonempty private build environment", async () => {
    const fixture = await mkdtemp(join(tmpdir(), "sevenview-community-guard-"))
    fixtures.push(fixture)
    await writeFile(join(fixture, "safe.txt"), "safe")
    const failure = await rejectedGuard(fixture, {
      ...process.env,
      VITE_BETA_TELEMETRY_ENDPOINT: "https://example.invalid",
    })
    expect(failure).toMatchObject({ code: 1 })
    expect(failure.stdout).toContain('"code": "forbidden-environment"')
  })
})
