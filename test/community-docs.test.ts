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
})
