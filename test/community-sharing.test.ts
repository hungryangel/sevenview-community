// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs"
import { expect, it } from "vitest"

it("exposes crawler-readable share metadata and resolvable icons without JavaScript", () => {
  const html = readFileSync("index.html", "utf8")
  const document = new DOMParser().parseFromString(html, "text/html")
  const image = document.querySelector('meta[property="og:image"]')?.getAttribute("content")
  expect(image).toBe("https://sevenview.velnoc.com/brand/sevenview-social.png")
  expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute("content")).toBe(
    "summary_large_image",
  )
  for (const rel of ["icon", "apple-touch-icon"]) {
    const href = document.querySelector(`link[rel="${rel}"]`)?.getAttribute("href")
    expect(href).toBeTruthy()
    expect(existsSync(`public${href}`)).toBe(true)
  }
  expect(existsSync("public/brand/sevenview-social.png")).toBe(true)
})
