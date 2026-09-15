import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const parseJsonc = async (path) =>
  JSON.parse((await readFile(path, "utf8")).replace(/^\s*\/\/.*$/gm, ""))

const preview = await parseJsonc(new URL("../wrangler.jsonc", import.meta.url))
const production = await parseJsonc(new URL("../wrangler.production.jsonc", import.meta.url))

assert.equal(production.name, "sevenview-usage")
assert.equal(production.main, preview.main)
assert.equal(production.vars.ALLOWED_ORIGIN, "https://sevenview.velnoc.com")
assert.equal(production.d1_databases.length, 1)
assert.equal(production.d1_databases[0].binding, "DB")
assert.equal(production.d1_databases[0].database_name, "sevenview-usage")
assert.notEqual(production.d1_databases[0].database_id, preview.d1_databases[0].database_id)
assert.equal(production.observability.enabled, false)
assert.equal(production.observability.logs.enabled, false)
assert.equal(production.observability.logs.invocation_logs, false)

console.log("production config: isolated D1 and observability disabled")
