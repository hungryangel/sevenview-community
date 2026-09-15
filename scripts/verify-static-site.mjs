import assert from "node:assert/strict"
import { readdir, readFile, stat } from "node:fs/promises"

const landing = await readFile("dist/index.html", "utf8")
const app = await readFile("dist/app.html", "utf8")
assert.match(landing, /건강한 삶의 가능성을,/)
assert.match(landing, /https:\/\/www.clarity.ms/)
assert.match(landing, /rel="canonical" href="https:\/\/sevenview.velnoc.com\/"/)
assert.match(app, /rel="canonical" href="https:\/\/sevenview.velnoc.com\/app"/)
assert.match(app, /connect-src &#39;self&#39;;/)
assert.doesNotMatch(app, /clarity\.ms/)
assert.match(app, /noindex, follow/)
let count = 0
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert(
      !["functions", "_worker.js", "_worker.js.map"].includes(entry.name),
      "No metered server functions",
    )
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) await inspect(path)
    else {
      count++
      assert((await stat(path)).size <= 25 * 1024 * 1024, `${path} exceeds Pages limit`)
    }
  }
}
await inspect("dist")
assert(count <= 20000)
console.log(`PASS: static-only hosting, SEO, app privacy CSP; ${count} files within Pages limits`)
