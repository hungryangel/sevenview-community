// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { CommunityLanding } from "../src/community/community-landing"

const repositoryUrl = "https://github.com/hungryangel/sevenview-community"
afterEach(cleanup)

describe("VELNOC Community guide", () => {
  it("connects the product to VELNOC and exposes the full getting-started journey", () => {
    const { container } = render(<CommunityLanding repositoryUrl={repositoryUrl} />)
    const homeLinks = screen.getAllByRole("link", { name: "VELNOC 홈페이지" })
    expect(homeLinks).toHaveLength(2)
    for (const link of homeLinks) expect(link.getAttribute("href")).toBe("https://velnoc.com/")
    for (const anchor of container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
      expect(document.getElementById(anchor.hash.slice(1))).not.toBeNull()
    }
    expect(
      screen.getByRole("heading", { name: "설치 없이 시작하거나, 직접 설치하세요." }),
    ).toBeTruthy()
    expect(screen.getByRole("link", { name: "상세 설치 안내" }).getAttribute("href")).toBe(
      `${repositoryUrl}/blob/main/docs/INSTALLATION.md`,
    )
    expect(
      screen.getByRole("link", { name: "합성 예시 사진 다운로드" }).hasAttribute("download"),
    ).toBe(true)
  })

  it("shows real illustrations with alternative text and separates paid service", () => {
    render(<CommunityLanding repositoryUrl={repositoryUrl} />)
    expect(
      screen.getAllByRole("img").filter((image) => image.getAttribute("alt") !== "").length,
    ).toBeGreaterThanOrEqual(3)
    expect(screen.getByRole("link", { name: "유료 커스터마이징 문의" })).toBeTruthy()
    expect(screen.getByText(/실제 환자나 시술 결과가 아닙니다/)).toBeTruthy()
  })

  it("does not invent repository links when no repository is configured", () => {
    const { container } = render(<CommunityLanding repositoryUrl={null} />)
    expect(container.querySelector('a[href*="null"]')).toBeNull()
    expect(screen.queryByRole("link", { name: "상세 설치 안내" })).toBeNull()
  })
})
