import React from "react"
import { createRoot } from "react-dom/client"

import { CommunityLanding } from "./community/community-landing"
import "./styles/tokens.css"
import "./styles/base.css"
import "./styles/primitives.css"
import "./styles/view-slot.css"
import "./styles/inspector-control.css"
import "./styles/app-shell.css"
import "./styles/workspace-layout.css"
import "./styles/product-components.css"
import "./styles/crop-workspace.css"
import "./styles/comparison-workspace.css"
import "./styles/comparison-editor.css"
import "./styles/comparison-paired-reference-editor.css"
import "./styles/comparison-alignment-dialog.css"
import "./styles/analysis-stage.css"
import "./styles/community.css"

class RootElementMissingError extends Error {
  readonly name = "RootElementMissingError"
  constructor() { super("The #root application mount point is missing") }
}

if (import.meta.env.DEV && import.meta.env.VITE_DISABLE_REACT_DEVTOOLS !== "1") {
  void import("react-grab")
  void import("react-scan")
}

const rootElement = document.getElementById("root")
if (rootElement === null) throw new RootElementMissingError()

const CommunityApp = React.lazy(() =>
  import("./product/sevenview-app").then((module) => ({ default: module.SevenViewApp })),
)
const pathname = window.location.pathname.replace(/\/$/, "") || "/"

function CommunityRoute() {
  switch (pathname) {
    case "/": return <CommunityLanding repositoryUrl="https://github.com/hungryangel/sevenview-community" />
    case "/app": return <React.Suspense fallback={<p className="community-loading">앱을 불러오는 중입니다.</p>}><CommunityApp /></React.Suspense>
    default: return <main className="community-not-found"><p className="community-eyebrow">404</p><h1>페이지를 찾을 수 없습니다.</h1><a className="community-button" href="/">소개로 돌아가기</a></main>
  }
}

createRoot(rootElement).render(<React.StrictMode><CommunityRoute /></React.StrictMode>)
