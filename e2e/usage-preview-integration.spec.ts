import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { extname, resolve } from "node:path"
import { expect, type Page, type Route, test } from "@playwright/test"

const OFFICIAL_ORIGIN = "https://sevenview.velnoc.com"
const PREVIEW_ENDPOINT = "https://sevenview-usage-preview.velnoc-demo.workers.dev/events"
const DIST_DIRECTORY = resolve("dist")
const evidenceDirectory =
  // biome-ignore lint/complexity/useLiteralKeys: strict Node env typing requires index access.
  process.env["SEVENVIEW_EVIDENCE_DIR"] ??
  "/Users/bee/redesignLLM/.omo/evidence/sevenview-usage-welcome/integration"

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".task": "application/octet-stream",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
}

type CapturedEvent = {
  readonly body: unknown
  readonly hasCookie: boolean
  readonly hasReferer: boolean
  status: number | null
}

function assetPath(pathname: string): string {
  if (pathname === "/") return resolve(DIST_DIRECTORY, "index.html")
  if (pathname === "/app") return resolve(DIST_DIRECTORY, "app.html")
  return resolve(DIST_DIRECTORY, `.${pathname}`)
}

async function fulfillOfficialAsset(route: Route): Promise<void> {
  const path = assetPath(new URL(route.request().url()).pathname)
  if (!path.startsWith(`${DIST_DIRECTORY}/`) || !existsSync(path)) {
    await route.fulfill({ status: 404, body: "Not found" })
    return
  }
  const extension = extname(path)
  await route.fulfill({
    body: readFileSync(path),
    headers: {
      "cache-control": "no-store",
      "content-type": CONTENT_TYPES[extension] ?? "application/octet-stream",
    },
    status: 200,
  })
}

function observePreviewEvents(page: Page, captured: CapturedEvent[]): void {
  page.on("request", (request) => {
    if (request.url() !== PREVIEW_ENDPOINT) return
    const headers = request.headers()
    captured.push({
      body: request.postDataJSON(),
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires index access for header maps.
      hasCookie: headers["cookie"] !== undefined,
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires index access for header maps.
      hasReferer: headers["referer"] !== undefined,
      status: null,
    })
  })
  page.on("response", (response) => {
    if (response.url() !== PREVIEW_ENDPOINT) return
    const event = captured.findLast((candidate) => candidate.status === null)
    if (event === undefined) return
    event.status = response.status()
  })
}

async function openOfficialApp(page: Page, expectWelcome = false): Promise<void> {
  await page.goto(`${OFFICIAL_ORIGIN}/app`)
  const closeWelcome = page.getByRole("button", { name: "환영 안내 닫기" })
  if (expectWelcome) {
    await expect(closeWelcome).toBeVisible()
    await closeWelcome.click()
  } else if (await closeWelcome.isVisible()) {
    await closeWelcome.click()
  }
  await expect(page.getByRole("heading", { name: "사진 접수" })).toBeVisible()
}

function eventNames(captured: readonly CapturedEvent[]): readonly unknown[] {
  return captured.map((event) => event.body)
}

test("official client sends only accepted aggregate events to the real preview collector", async ({
  context,
  page,
}) => {
  test.skip(
    // biome-ignore lint/complexity/useLiteralKeys: strict Node env typing requires index access.
    process.env["SEVENVIEW_RUN_PREVIEW_INTEGRATION"] !== "1",
    "Explicit preview D1 integration only",
  )
  await context.route(`${OFFICIAL_ORIGIN}/**`, fulfillOfficialAsset)
  const captured: CapturedEvent[] = []
  observePreviewEvents(page, captured)

  // Given: the preview-configured production build runs at the official origin.
  const landingResponse = page.waitForResponse(PREVIEW_ENDPOINT)
  await page.goto(`${OFFICIAL_ORIGIN}/`)
  expect((await landingResponse).status()).toBe(204)
  expect(eventNames(captured)).toEqual([{ event: "landing_visit" }])

  // When: a public synthetic photo is accepted and analyzed, but the first export is cancelled.
  await openOfficialApp(page, true)
  const appResponse = page.waitForResponse(PREVIEW_ENDPOINT)
  await page.locator('input[type="file"]').first().setInputFiles("public/examples/01-front.png")
  expect((await appResponse).status()).toBe(204)
  await page.getByRole("button", { name: /AI 자동 정렬/ }).click()
  const exportButton = page.getByRole("button", { name: "내보내기", exact: true })
  await expect(exportButton).toBeVisible({ timeout: 60_000 })
  await exportButton.click()
  await page.getByRole("button", { name: "취소", exact: true }).click()
  expect(eventNames(captured)).toEqual([{ event: "landing_visit" }, { event: "app_use" }])

  // Then: one successful download handoff produces one server-accepted export event.
  await exportButton.click()
  const exportResponse = page.waitForResponse(PREVIEW_ENDPOINT)
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "저장하기" }).click()
  await download
  expect((await exportResponse).status()).toBe(204)
  expect(eventNames(captured)).toEqual([
    { event: "landing_visit" },
    { event: "app_use" },
    { event: "export_complete" },
  ])

  // And: rejected input and an opted-out landing in fresh tabs add no requests.
  const rejectedPage = await context.newPage()
  observePreviewEvents(rejectedPage, captured)
  await openOfficialApp(rejectedPage)
  await rejectedPage
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      buffer: Buffer.from("not an image"),
      mimeType: "text/plain",
      name: "synthetic-invalid.txt",
    })
  const optedOutPage = await context.newPage()
  await optedOutPage.addInitScript(() =>
    localStorage.setItem("sevenview:usage-enabled", "disabled"),
  )
  observePreviewEvents(optedOutPage, captured)
  await optedOutPage.goto(`${OFFICIAL_ORIGIN}/`)
  await expect(optedOutPage.getByRole("heading", { name: /사진을 정리하는 시간/ })).toBeVisible()
  expect(eventNames(captured)).toEqual([
    { event: "landing_visit" },
    { event: "app_use" },
    { event: "export_complete" },
  ])

  for (const event of captured) {
    expect(event).toMatchObject({ hasCookie: false, hasReferer: false, status: 204 })
    if (typeof event.body !== "object" || event.body === null) {
      throw new TypeError("Preview event body must be an object")
    }
    expect(Object.keys(event.body)).toEqual(["event"])
  }
  mkdirSync(evidenceDirectory, { recursive: true })
  writeFileSync(
    resolve(evidenceDirectory, "client-preview-wire.json"),
    JSON.stringify({ events: captured, rejectedEventCount: 0, optedOutEventCount: 0 }, null, 2),
  )
})
