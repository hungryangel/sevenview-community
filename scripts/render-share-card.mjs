import { chromium } from "@playwright/test"

const browser = await chromium.launch({ channel: "chrome" })
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  })
  await page.goto("http://127.0.0.1:4390/scripts/share-card.html")
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((image) => image.decode()))
  })
  await page.screenshot({ path: "public/brand/sevenview-social.png" })
} finally {
  await browser.close()
}
