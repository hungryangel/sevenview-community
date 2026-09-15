import { useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"
import { REVIEW_SUCCESS_NOTICE_DURATION_MS, TransientReviewNotice } from "./transient-review-notice"
import type { WorkspaceMessage } from "./workspace-types"

type WorkspaceReviewNoticeProps = {
  readonly host: HTMLElement | null
  readonly message: WorkspaceMessage | null
  readonly onDismiss: () => void
}

export function WorkspaceReviewNotice({ host, message, onDismiss }: WorkspaceReviewNoticeProps) {
  const [container] = useState(() => document.createElement("div"))
  useLayoutEffect(() => {
    host?.appendChild(container)
    return () => container.remove()
  }, [container, host])
  if (message === null) return null
  return createPortal(
    <div className="review-notice-stack">
      <TransientReviewNotice
        autoDismissMs={message.kind === "success" ? REVIEW_SUCCESS_NOTICE_DURATION_MS : undefined}
        kind={message.kind}
        key={`workspace-message-${message.title}`}
        onDismiss={onDismiss}
        title={message.title}
      >
        {message.text}
      </TransientReviewNotice>
    </div>,
    container,
  )
}
