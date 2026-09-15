import { useState } from "react"

import { AppFooter } from "./app-footer"
import { useGuideColor } from "./guide-color"
import { useGuideWidth } from "./guide-width"
import { HelpSurface } from "./help-surface"

type WorkspaceStandaloneFooterProps = {
  readonly exportCount: number
  readonly reviewCount: number
  readonly sessionStartedAt: number
}

export function WorkspaceStandaloneFooter({
  exportCount,
  reviewCount,
  sessionStartedAt,
}: WorkspaceStandaloneFooterProps) {
  const [helpOpen, setHelpOpen] = useState(false)
  const [guideColor, changeGuideColor] = useGuideColor()
  const [guideWidth, changeGuideWidth] = useGuideWidth()

  return (
    <>
      <AppFooter onOpenHelp={() => setHelpOpen(true)} />
      <HelpSurface
        exportCount={exportCount}
        guideColor={guideColor}
        guideWidth={guideWidth}
        onChangeGuideColor={changeGuideColor}
        onChangeGuideWidth={changeGuideWidth}
        onClose={() => setHelpOpen(false)}
        open={helpOpen}
        reviewCount={reviewCount}
        sessionStartedAt={sessionStartedAt}
      />
    </>
  )
}
