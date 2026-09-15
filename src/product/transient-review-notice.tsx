import {
  type ReactNode,
  type TransitionEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { Notice, type NoticeKind } from "../ui/notice"

export const REVIEW_SUCCESS_NOTICE_DURATION_MS = 6_000
const EXIT_FALLBACK_MS = 300

type TransientReviewNoticeProps = {
  readonly autoDismissMs?: number | undefined
  readonly children: ReactNode
  readonly kind: NoticeKind
  readonly onDismiss: () => void
  readonly title: string
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  )
}

export function TransientReviewNotice({
  autoDismissMs,
  children,
  kind,
  onDismiss,
  title,
}: TransientReviewNoticeProps) {
  const [leaving, setLeaving] = useState(false)
  const dismissed = useRef(false)
  const finishDismissal = useCallback(() => {
    if (dismissed.current) return
    dismissed.current = true
    onDismiss()
  }, [onDismiss])
  const requestDismissal = useCallback(() => {
    if (prefersReducedMotion()) {
      finishDismissal()
      return
    }
    setLeaving(true)
  }, [finishDismissal])

  useEffect(() => {
    if (!leaving) return
    // Moving the portal host can cancel the 220ms opacity transition without transitionend.
    const timer = window.setTimeout(finishDismissal, EXIT_FALLBACK_MS)
    return () => window.clearTimeout(timer)
  }, [finishDismissal, leaving])

  useEffect(() => {
    if (autoDismissMs === undefined) {
      return
    }
    const timer = window.setTimeout(requestDismissal, autoDismissMs)
    return () => window.clearTimeout(timer)
  }, [autoDismissMs, requestDismissal])

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (leaving && event.currentTarget === event.target && event.propertyName === "opacity") {
      finishDismissal()
    }
  }

  return (
    <div
      className={`transient-review-notice${leaving ? " transient-review-notice--leaving" : ""}`}
      onTransitionEnd={handleTransitionEnd}
    >
      <Notice dismissible kind={kind} onDismiss={requestDismissal} title={title}>
        {children}
      </Notice>
    </div>
  )
}
