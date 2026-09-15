import { createHash } from "node:crypto"
import { readdir, readFile, stat } from "node:fs/promises"
import { resolve } from "node:path"
import { inspectCommunityRelease } from "./community-release-guard.mjs"

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".wrangler",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
])

async function inventory(root, directory = root) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue
    const absolute = resolve(directory, entry.name)
    if (entry.isDirectory()) result.push(...(await inventory(root, absolute)))
    else if ((await stat(absolute)).isFile())
      result.push({
        path: absolute.slice(root.length + 1),
        sha256: createHash("sha256")
          .update(await readFile(absolute))
          .digest("hex"),
      })
  }
  return result.sort((left, right) => left.path.localeCompare(right.path))
}

const root = process.cwd()
const findings = await inspectCommunityRelease(root)
const files = await inventory(root)
const report = {
  ok: findings.length === 0,
  fileCount: files.length,
  findings,
  inventorySha256: createHash("sha256").update(JSON.stringify(files)).digest("hex"),
}
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
