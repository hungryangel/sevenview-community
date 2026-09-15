import { z } from "zod"

const MAX_BODY_BYTES = 64
const EVENT_SCHEMA = z.strictObject({
  event: z.enum(["landing_visit", "app_use", "export_complete"]),
})

type BodyReadResult =
  | { readonly kind: "ok"; readonly text: string }
  | { readonly kind: "invalid" }
  | { readonly kind: "too_large" }

function corsHeaders(origin: string): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Cache-Control": "no-store",
    Vary: "Origin",
  })
}

async function readBoundedBody(request: Request): Promise<BodyReadResult> {
  const declaredLength = request.headers.get("Content-Length")
  if (declaredLength !== null && Number(declaredLength) > MAX_BODY_BYTES) {
    return { kind: "too_large" }
  }

  if (request.body === null) return { kind: "invalid" }

  const reader = request.body.getReader()
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false })
  let byteCount = 0
  let text = ""

  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      byteCount += chunk.value.byteLength
      if (byteCount > MAX_BODY_BYTES) {
        await reader.cancel()
        return { kind: "too_large" }
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
    text += decoder.decode()
    return { kind: "ok", text }
  } catch (error) {
    if (error instanceof TypeError) return { kind: "invalid" }
    throw error
  } finally {
    reader.releaseLock()
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== "/events") return new Response(null, { status: 404 })

    const origin = request.headers.get("Origin")
    if (origin !== env.ALLOWED_ORIGIN) return new Response(null, { status: 403 })

    const headers = corsHeaders(origin)
    if (request.method === "OPTIONS") {
      const requestedMethod = request.headers.get("Access-Control-Request-Method")
      const requestedHeaders = request.headers.get("Access-Control-Request-Headers")
      if (requestedMethod !== "POST" || requestedHeaders?.toLowerCase() !== "content-type") {
        return new Response(null, { status: 403, headers })
      }
      headers.set("Access-Control-Allow-Methods", "POST")
      headers.set("Access-Control-Allow-Headers", "Content-Type")
      headers.set("Access-Control-Max-Age", "86400")
      return new Response(null, { status: 204, headers })
    }

    if (request.method !== "POST") return new Response(null, { status: 404, headers })
    if (request.headers.get("Content-Type") !== "application/json") {
      return new Response(null, { status: 415, headers })
    }

    const body = await readBoundedBody(request)
    switch (body.kind) {
      case "invalid":
        return new Response(null, { status: 400, headers })
      case "too_large":
        return new Response(null, { status: 413, headers })
      case "ok":
        break
      default:
        body satisfies never
    }

    let candidate: unknown
    try {
      candidate = JSON.parse(body.text)
    } catch (error) {
      if (error instanceof SyntaxError) return new Response(null, { status: 400, headers })
      throw error
    }

    const parsed = EVENT_SCHEMA.safeParse(candidate)
    if (!parsed.success) return new Response(null, { status: 400, headers })

    const now = new Date()
    const day = now.toISOString().slice(0, 10)
    now.setUTCDate(now.getUTCDate() - 89)
    const retentionStart = now.toISOString().slice(0, 10)

    try {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM daily_counts WHERE day < ?1").bind(retentionStart),
        env.DB.prepare(
          "INSERT INTO daily_counts(day, event, count) VALUES (?1, ?2, 1) " +
            "ON CONFLICT(day, event) DO UPDATE SET count = count + 1",
        ).bind(day, parsed.data.event),
      ])
    } catch {
      // no-excuse-ok: catch — the HTTP boundary maps storage outages without retaining request data.
      return new Response(null, { status: 503, headers })
    }

    return new Response(null, { status: 204, headers })
  },
} satisfies ExportedHandler<Env>

// biome-ignore lint/style/noDefaultExport: Cloudflare Workers require the module handler as default.
export default worker
