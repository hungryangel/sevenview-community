type ClarityCommand = (...args: readonly unknown[]) => void
type ClarityQueue = ClarityCommand & { q?: (readonly unknown[])[] }
declare global {
  interface Window {
    clarity?: ClarityQueue
  }
}

export function isAnalyticsPage(
  location: Pick<Location, "protocol" | "hostname" | "pathname" | "search" | "hash">,
): boolean {
  return (
    location.protocol === "https:" &&
    location.hostname === "sevenview.velnoc.com" &&
    location.pathname === "/" &&
    location.search === "" &&
    location.hash === ""
  )
}

export function enableLandingAnalytics(): boolean {
  if (!isAnalyticsPage(window.location)) return false
  if (document.getElementById("sv-clarity")) return true
  const queue: ClarityQueue = (...args) => {
    if (queue.q === undefined) queue.q = []
    queue.q.push(args)
  }
  window.clarity = queue
  queue("consentv2", { ad_Storage: "denied", analytics_Storage: "denied" })
  queue("set", "site", "sevenview-introduction")
  const script = document.createElement("script")
  script.id = "sv-clarity"
  script.async = true
  script.src = "https://www.clarity.ms/tag/wumcfmz2bq"
  document.head.append(script)
  return true
}
