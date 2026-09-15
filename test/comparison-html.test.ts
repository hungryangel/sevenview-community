// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it } from "vitest"
import { buildComparisonHtml } from "../src/adapters/comparison-html"
import { installComparisonSlider } from "../src/adapters/comparison-html-runtime"

const photos = [
  { slot: "after", png: new Uint8Array([10, 20, 30]) },
  { slot: "before", png: new Uint8Array([40, 50, 60]) },
] as const

function documentForExport() {
  const html = new TextDecoder().decode(buildComparisonHtml(photos))
  return new DOMParser().parseFromString(html, "text/html")
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("offline comparison document", () => {
  it("embeds only final crop bytes and the original logo when the HTML is built", () => {
    // Given: two already-rendered crops in after-first order.
    const wordmark = readFileSync("public/brand/velnoc-wordmark-white.png")
    // When: the standalone document is generated.
    const output = documentForExport()
    // Then: every image is embedded with intact semantic identity and no original source URL.
    const images = [...output.querySelectorAll(".photo img")]
    expect(images.map((image) => image.getAttribute("src"))).toEqual([
      "data:image/png;base64,ChQe",
      "data:image/png;base64,KDI8",
    ])
    expect(
      [...output.querySelectorAll(".photo")].map((image) => image.getAttribute("data-slot")),
    ).toEqual(["after", "before"])
    expect(output.querySelector("img[alt='VELNOC']")?.getAttribute("src")).toBe(
      `data:image/png;base64,${wordmark.toString("base64")}`,
    )
    expect(output.querySelectorAll("img")).toHaveLength(3)
    expect(output.querySelectorAll("[src^='http'],script[src],link")).toHaveLength(0)
  })

  it("keeps the logo static and offers only the fixed contact destination", () => {
    // Given: final crops with no public source URLs.
    // When: a branded standalone document is generated.
    const output = documentForExport()
    // Then: the logo is not navigation and only the fixed contact destination remains.
    const links = [...output.querySelectorAll("a")]
    expect(links.map((link) => link.href)).toEqual(["http://pf.kakao.com/_JDbbX/chat"])
    const logo = output.querySelector("header img.brand-logo[alt='VELNOC']")
    expect(logo).not.toBeNull()
    expect(logo?.closest("a")).toBeNull()
    expect(output.documentElement.outerHTML).not.toContain("hungryangel.github.io")
    expect(links[0]?.textContent).toBe("연락하기")
    expect(links[0]?.getAttribute("aria-label")).toBe("연락하기 (새 탭)")
    for (const link of links) {
      expect(link.target).toBe("_blank")
      expect(link.relList.contains("noopener")).toBe(true)
      expect(link.relList.contains("noreferrer")).toBe(true)
      expect(link.getAttribute("referrerpolicy")).toBe("no-referrer")
    }
  })

  it("limits execution to the packaged script when a fresh document is generated", () => {
    // Given: a static standalone export.
    // When: its resource policy and inline runtime are read.
    const output = documentForExport()
    const policy = output
      .querySelector("meta[http-equiv='Content-Security-Policy']")
      ?.getAttribute("content")
    const script = output.querySelector("script")
    // Then: no networking or external code is allowed, with a fresh nonce for the one runtime.
    expect(policy).toContain("default-src 'none'")
    expect(policy).toContain("connect-src 'none'")
    expect(policy).toContain("img-src data:")
    expect(script?.nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/)
    expect(policy).toContain(`script-src 'nonce-${script?.nonce}'`)
    expect(output.querySelectorAll("script")).toHaveLength(1)
    expect(script?.nonce).not.toBe(documentForExport().querySelector("script")?.nonce)
    expect(output.querySelector("noscript")).not.toBeNull()
  })
})

describe("packaged comparison controls", () => {
  it.each(["ArrowRight", "ArrowLeft", "Home", "End"])(
    "synchronizes the physical boundary when %s is pressed",
    (key) => {
      // Given: an after-first HTML document with its real runtime installed.
      document.body.innerHTML = documentForExport().body.innerHTML
      installComparisonSlider()
      const divider = document.getElementById("divider")
      // When: the keyboard moves the boundary.
      divider?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))
      // Then: visual position and accessible/range values are identical.
      const expected = { ArrowRight: "51", ArrowLeft: "49", Home: "0", End: "100" }[key]
      expect(divider?.getAttribute("aria-valuenow")).toBe(expected)
      expect(document.querySelector<HTMLInputElement>("#position")?.value).toBe(expected)
      expect(document.getElementById("stage")?.style.getPropertyValue("--position")).toBe(
        `${expected}%`,
      )
    },
  )

  it("keeps boundary coordinates when presentation order is reversed", () => {
    // Given: a boundary moved to 73 percent.
    document.body.innerHTML = documentForExport().body.innerHTML
    installComparisonSlider()
    const range = document.querySelector<HTMLInputElement>("#position")
    if (range === null) throw new Error("Missing exported range")
    range.value = "73"
    range.dispatchEvent(new Event("input", { bubbles: true }))
    // When: only presentation order is reversed.
    document.getElementById("reverse")?.click()
    // Then: the opposite semantic photo is on the left but the screen boundary stays at 73%.
    expect(document.querySelector(".photo--left")?.getAttribute("data-slot")).toBe("before")
    expect(document.querySelector(".photo--right")?.getAttribute("data-slot")).toBe("after")
    expect(document.getElementById("divider")?.getAttribute("aria-valuenow")).toBe("73")
    expect(range.value).toBe("73")
  })

  it("returns to the midpoint when center reset is requested", () => {
    // Given: the boundary is at its far edge.
    document.body.innerHTML = documentForExport().body.innerHTML
    installComparisonSlider()
    document.getElementById("divider")?.dispatchEvent(new KeyboardEvent("keydown", { key: "End" }))
    // When: center reset is pressed.
    document.getElementById("center")?.click()
    // Then: both comparison controls return to 50%.
    expect(document.querySelector<HTMLInputElement>("#position")?.value).toBe("50")
    expect(document.getElementById("divider")?.getAttribute("aria-valuenow")).toBe("50")
  })
})
