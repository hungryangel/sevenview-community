// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { useWorkspace } from "../src/product/use-workspace"
import { useWorkspaceReview } from "../src/product/use-workspace-review"
import { WorkspaceReviewSurface } from "../src/product/workspace-review-surface"

afterEach(cleanup)

function ReviewSurfaceHarness({ embedded }: { readonly embedded: boolean }) {
  const workspace = useWorkspace()
  const review = useWorkspaceReview(workspace, true)
  return (
    <WorkspaceReviewSurface
      embedded={embedded}
      onEditorNoticeHost={() => undefined}
      onGalleryNoticeHost={() => undefined}
      review={review}
      workspace={workspace}
    />
  )
}

describe("review surface landmarks", () => {
  it("keeps the standalone skip-link destination", () => {
    render(<ReviewSurfaceHarness embedded={false} />)
    expect(screen.getByRole("main").id).toBe("main-content")
    expect(screen.getByRole("main").tabIndex).toBe(-1)
  })

  it("does not nest another main inside the embedded app shell", () => {
    render(<ReviewSurfaceHarness embedded />)
    expect(screen.queryByRole("main")).toBeNull()
    expect(screen.getByRole("region", { name: "촬영 세트 현황" })).toBeDefined()
  })
})
