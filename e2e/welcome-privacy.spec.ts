import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "@playwright/test"

const evidenceDirectory =
  // biome-ignore lint/complexity/useLiteralKeys: strict Node env typing requires index access.
  process.env["SEVENVIEW_EVIDENCE_DIR"] ??
  "/Users/bee/redesignLLM/.omo/evidence/sevenview-usage-welcome/frontend/browser"

for (const width of [375, 768, 1280] as const) {
  test(`fresh welcome is readable at ${width}px`, async ({ page }) => {
    // Given: a fresh browser at the app route.
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/app")
    await page.evaluate(() => localStorage.removeItem("sevenview:welcome-version"))
    await page.reload()

    // When: the current-version welcome opens.
    const dialog = page.getByRole("dialog", {
      name: "SevenView Community에 오신 것을 환영합니다",
    })
    await expect(dialog).toBeVisible()

    // Then: it fits the viewport and retains its release/instruction structure.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
    await expect(dialog.getByRole("heading", { level: 3 })).toHaveCount(2)
    mkdirSync(evidenceDirectory, { recursive: true })
    await page.screenshot({
      path: join(evidenceDirectory, `welcome-${width}.png`),
    })
    await dialog.getByRole("button", { name: "환영 안내 닫기" }).click()
    await page.getByRole("button", { name: "설정 · 정보" }).click()
    const settings = page.getByRole("dialog", { name: "설정 · 정보" })
    await settings.locator("#usage-privacy").scrollIntoViewIfNeeded()
    await settings.screenshot({ path: join(evidenceDirectory, `usage-settings-${width}.png`) })
  })
}

test("welcome supports Escape, settings reopen, focus return, and independent privacy control", async ({
  page,
}) => {
  // Given: a fresh welcome dialog with default collection enabled.
  await page.goto("/app")
  await page.evaluate(() => {
    localStorage.removeItem("sevenview:welcome-version")
    localStorage.removeItem("sevenview:usage-enabled")
  })
  await page.reload()
  const welcome = page.getByRole("dialog", {
    name: "SevenView Community에 오신 것을 환영합니다",
  })
  await expect(welcome).toBeVisible()
  await expect(welcome.getByRole("button", { name: "환영 안내 닫기" })).toBeFocused()

  // When: Escape dismisses it and the user reopens it from settings.
  await page.keyboard.press("Escape")
  await expect(welcome).toBeHidden()
  const settings = page.getByRole("button", { name: "설정 · 정보" })
  await settings.click()
  await page.getByRole("button", { name: "환영 안내 다시 보기" }).click()
  await expect(welcome).toBeVisible()
  await page.keyboard.press("Escape")

  // Then: focus returns to settings and privacy remains independently configurable.
  await expect(settings).toBeFocused()
  await settings.click()
  const preference = page.getByRole("checkbox", { name: "익명 사용 집계 허용" })
  await expect(preference).toBeChecked()
  await preference.uncheck()
  await expect(preference).not.toBeChecked()
  await expect(page.getByRole("dialog", { name: "설정 · 정보" })).toBeVisible()
})
