import assert from "node:assert/strict"
import { buildContentSecurityPolicy } from "../../build/content-security-policy.ts"

// Given an exact collector endpoint configured for the official build.
const endpoint = "https://sevenview-usage-preview.velnoc-demo.workers.dev/events"

// When the application CSP is generated.
const policy = buildContentSecurityPolicy(endpoint)

// Then only the collector origin is allowed, never the path or a wildcard.
assert.match(
  policy,
  /connect-src 'self' https:\/\/sevenview-usage-preview\.velnoc-demo\.workers\.dev/,
)
assert.doesNotMatch(policy, /workers\.dev\/events/)
assert.doesNotMatch(policy, /\*\.workers\.dev/)

console.log("PASS: CSP permits only the configured collector origin")
