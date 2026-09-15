import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { describe, expect, it } from "vitest"

const documents = [
  "README.md",
  "README.ko.md",
  "docs/INSTALLATION.md",
  "docs/USER_GUIDE.md",
  "docs/ASSETS.md",
] as const

describe("published getting-started documents", () => {
  for (const document of documents) {
    it(`${document} resolves local links and images`, () => {
      const source = readFileSync(document, "utf8")
      const targets = [...source.matchAll(/\]\(([^)]+)\)|src="([^"]+)"/g)]
      for (const match of targets) {
        const target = match[1] ?? match[2]
        if (target === undefined || /^(https?:|#)/.test(target)) continue
        const path = target.split("#")[0]
        if (path === undefined) continue
        expect(existsSync(resolve(dirname(document), path)), `${document} → ${path}`).toBe(true)
      }
    })
  }

  it("provides a complete reproducible quick start using the pinned package manager", () => {
    const source = readFileSync("README.md", "utf8")
    expect(source).toContain("git clone https://github.com/hungryangel/sevenview-community.git")
    expect(source).toContain("cd sevenview-community")
    expect(source).toContain("pnpm install --frozen-lockfile")
    expect(source).toContain("pnpm dev")
    expect(source).toContain("Korean")
  })

  it("ships actual PNG screenshots with the declared dimensions", () => {
    for (const name of ["workspace", "comparison"]) {
      const image = readFileSync(`public/examples/${name}.png`)
      expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
      expect(image.readUInt32BE(16)).toBe(1440)
      expect(image.readUInt32BE(20)).toBe(1000)
    }
  })
})
