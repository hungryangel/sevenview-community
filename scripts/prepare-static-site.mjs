import { readFile, writeFile } from "node:fs/promises"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { createServer } from "vite"

const origin = "https://sevenview.velnoc.com"
const template = await readFile("dist/index.html", "utf8")
await writeFile(
  "dist/app.html",
  template
    .replaceAll(`${origin}/"`, `${origin}/app"`)
    .replace(/<title>.*?<\/title>/, "<title>사진 정렬·전후 비교 앱 | SevenView · VELNOC</title>")
    .replace(
      '<meta name="robots" content="index, follow"',
      '<meta name="robots" content="noindex, follow"',
    ),
)
await writeFile(
  "dist/404.html",
  template.replace(
    '<meta name="robots" content="index, follow"',
    '<meta name="robots" content="noindex, follow"',
  ),
)

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
try {
  const { CommunityLanding } = await server.ssrLoadModule("/src/community/community-landing.tsx")
  const markup = renderToString(
    createElement(CommunityLanding, {
      repositoryUrl: "https://github.com/hungryangel/sevenview-community",
    }),
  )
  const landing = template
    .replace('<div id="root"></div>', `<div id="root">${markup}</div>`)
    .replace(
      "script-src &#39;self&#39; &#39;wasm-unsafe-eval&#39;",
      "script-src &#39;self&#39; https://www.clarity.ms https://scripts.clarity.ms",
    )
    .replace("connect-src &#39;self&#39;", "connect-src &#39;self&#39; https://*.clarity.ms")
    .replace(
      "img-src &#39;self&#39; blob: data:",
      "img-src &#39;self&#39; data: https://*.clarity.ms",
    )
  await writeFile("dist/index.html", landing)
} finally {
  await server.close()
}
