import { lstat, readdir, readFile, realpath } from "node:fs/promises"
import { relative, resolve, sep } from "node:path"

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".wrangler",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
])
const APPROVED_BINARY = new Set([
  ...["public", "dist"].flatMap((root) => [
    `${root}/brand/velnoc-wordmark.png`,
    `${root}/brand/velnoc-favicon-32.png`,
    `${root}/brand/velnoc-favicon-180.png`,
    `${root}/brand/sevenview-social.png`,
    `${root}/fonts/PretendardVariable.woff2`,
    ...[
      "01-front",
      "02-right-oblique",
      "03-left-oblique",
      "04-right-profile",
      "05-left-profile",
      "06-chin-up",
      "07-crown-down",
      "workspace",
      "comparison",
    ].map((name) => `${root}/examples/${name}.png`),
  ]),
  "public/brand/velnoc-mark-white.png",
  "public/brand/velnoc-wordmark-white.png",
  "public/models/face_landmarker.task",
  "public/models/pose_landmarker_lite.task",
  "dist/brand/velnoc-mark-white.png",
  "dist/brand/velnoc-wordmark-white.png",
  "dist/models/face_landmarker.task",
  "dist/models/pose_landmarker_lite.task",
])
const FORBIDDEN_PATH_PARTS = [
  ["src", "beta"].join("/"),
  ["change", "measurement"].join("-"),
  ["regional", "contour"].join("-"),
  ["export", "survey"].join("-"),
]
const FORBIDDEN_CONTENT = [
  ["sevenview", "change", "measurement", "report", "v1"].join("."),
  ["survey", "submitted"].join("_"),
]

async function walk(root, directory = root) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue
    const absolute = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(root, absolute)))
    else files.push(absolute)
  }
  return files
}

export async function inspectCommunityRelease(root = process.cwd()) {
  const canonicalRoot = await realpath(root)
  const findings = []
  if (process.env.VITE_BETA_TELEMETRY_ENDPOINT !== undefined) {
    findings.push({ code: "forbidden-environment", path: "VITE_BETA_TELEMETRY_ENDPOINT" })
  }
  for (const absolute of await walk(canonicalRoot)) {
    const path = relative(canonicalRoot, absolute).split(sep).join("/")
    if (
      path === ".env" ||
      path.startsWith(".env.") ||
      path.startsWith(".vercel/") ||
      path.startsWith(".omo/")
    )
      findings.push({ code: "private-path", path })
    if (FORBIDDEN_PATH_PARTS.some((part) => path.toLowerCase().includes(part)))
      findings.push({ code: "forbidden-family", path })
    if (path.endsWith(".map")) findings.push({ code: "source-map", path })
    const stat = await lstat(absolute)
    if (stat.isSymbolicLink()) {
      const target = await realpath(absolute)
      if (target !== canonicalRoot && !target.startsWith(`${canonicalRoot}${sep}`))
        findings.push({ code: "external-symlink", path })
      continue
    }
    const data = await readFile(absolute)
    const binary = data.subarray(0, 8192).includes(0)
    if (binary) {
      const generatedFont = path.startsWith("dist/assets/") && path.endsWith(".woff2")
      if (!APPROVED_BINARY.has(path) && !path.startsWith("dist/wasm/") && !generatedFont)
        findings.push({ code: "unapproved-binary", path })
      continue
    }
    if (
      path === "scripts/community-release-guard.mjs" ||
      path === "test/community-release-guard.test.ts"
    )
      continue
    const content = data.toString("utf8")
    for (const marker of FORBIDDEN_CONTENT)
      if (content.includes(marker)) findings.push({ code: "forbidden-payload", path })
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content))
      findings.push({ code: "secret-shaped-content", path })
  }
  return findings
}
