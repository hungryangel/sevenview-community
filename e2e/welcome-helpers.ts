import type { Page } from "@playwright/test"

export async function dismissWelcomeIfPresent(page: Page): Promise<void> {
  const close = page.getByRole("button", { name: "환영 안내 닫기" })
  if (await close.isVisible()) await close.click()
}
