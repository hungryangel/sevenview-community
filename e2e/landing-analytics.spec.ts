import { expect, test } from "@playwright/test"
import { dismissWelcomeIfPresent } from "./welcome-helpers"

test("official introduction opt-in sends Clarity without enabling it in the app", async ({
  page,
  baseURL,
  context,
}) => {
  test.skip(baseURL !== "https://sevenview.velnoc.com", "Official host integration only")
  const clarityRequests: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).hostname.endsWith(".clarity.ms")) clarityRequests.push(request.url())
  })
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /사진을 정리하는 시간/ })).toBeVisible()
  expect(clarityRequests).toEqual([])
  await page.getByText("소개 페이지 사용 분석 · 꺼짐", { exact: true }).click()
  const collection = page.waitForResponse(
    (response) =>
      new URL(response.url()).hostname.endsWith(".clarity.ms") &&
      new URL(response.url()).pathname === "/collect" &&
      response.ok(),
    { timeout: 30_000 },
  )
  await page.getByRole("button", { name: "이번 소개 페이지 분석 허용" }).click()
  await collection
  expect(
    (await context.cookies()).filter((cookie) => ["_clck", "_clsk"].includes(cookie.name)),
  ).toEqual([])
  await page.goto("/app")
  await dismissWelcomeIfPresent(page)
  clarityRequests.length = 0
  await expect(page.getByRole("heading", { name: "사진 접수" })).toBeVisible()
  expect(await page.locator("#sv-clarity").count()).toBe(0)
  expect(clarityRequests).toEqual([])
})
