import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "@playwright/test"

const evidenceDirectory = process.env["SEVENVIEW_EVIDENCE_DIR"] ?? "test-results/community"

test("landing stays lightweight and opens the ungated app", async ({ page }) => {
  const requests: Array<{
    readonly method: string
    readonly origin: string
    readonly resourceType: string
    readonly url: string
  }> = []
  page.on("request", (request) =>
    requests.push({
      method: request.method(),
      origin: new URL(request.url()).origin,
      resourceType: request.resourceType(),
      url: request.url(),
    }),
  )

  await page.goto("/")
  await expect(page.getByRole("heading", { name: /사진을 정리하는 시간/ })).toBeVisible()
  await expect(page.getByRole("link", { name: "GitHub · English" })).toHaveAttribute(
    "href",
    "https://github.com/hungryangel/sevenview-community",
  )
  expect(
    requests.some((request) => request.url.endsWith(".task") || request.url.includes("/wasm/")),
  ).toBe(false)

  await page.getByRole("link", { name: "무료 앱 시작" }).click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole("heading", { name: "사진 접수" })).toBeVisible()
  await expect(page.getByText(/초대 코드/)).toHaveCount(0)
  expect(requests.filter((request) => request.method !== "GET")).toEqual([])
  mkdirSync(evidenceDirectory, { recursive: true })
  writeFileSync(
    join(evidenceDirectory, "task-4-network.json"),
    JSON.stringify(
      {
        requests: requests.map(({ method, origin, resourceType }) => ({
          method,
          origin,
          resourceType,
        })),
      },
      null,
      2,
    ),
  )
})

for (const width of [375, 768, 1280] as const) {
  test(`landing is readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/")
    await expect(page.getByRole("heading", { name: /사진을 정리하는 시간/ })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
    mkdirSync(evidenceDirectory, { recursive: true })
    await page.screenshot({ fullPage: true, path: join(evidenceDirectory, `task-6-${width}.png`) })
  })
}

test("direct app reload and unknown route remain navigable", async ({ page }) => {
  await page.goto("/app")
  await page.reload()
  await expect(page.getByRole("heading", { name: "사진 접수" })).toBeVisible()

  await page.goto("/not-a-route")
  await expect(page.getByRole("heading", { name: "페이지를 찾을 수 없습니다." })).toBeVisible()
  await expect(page.getByRole("link", { name: "소개로 돌아가기" })).toHaveAttribute("href", "/")
})
