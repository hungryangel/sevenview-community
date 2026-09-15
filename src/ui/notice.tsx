import { CheckCircle, Info, WarningCircle, X, XCircle } from "@phosphor-icons/react"
import type { ReactNode } from "react"

export type NoticeKind = "info" | "success" | "warning" | "error"

type NoticeProps = {
  readonly children: ReactNode
  readonly dismissible?: boolean
  readonly kind: NoticeKind
  readonly onDismiss?: () => void
  readonly progress?: number
  readonly title: string
}

function NoticeIcon({ kind }: { readonly kind: NoticeKind }) {
  switch (kind) {
    case "info":
      return <Info aria-hidden="true" size={20} weight="fill" />
    case "success":
      return <CheckCircle aria-hidden="true" size={20} weight="fill" />
    case "warning":
      return <WarningCircle aria-hidden="true" size={20} weight="fill" />
    case "error":
      return <XCircle aria-hidden="true" size={20} weight="fill" />
  }
}

export function Notice({
  children,
  dismissible = false,
  kind,
  onDismiss,
  progress,
  title,
}: NoticeProps) {
  return (
    <div className={`notice notice--${kind}`} role={kind === "error" ? "alert" : "status"}>
      <NoticeIcon kind={kind} />
      <div className="notice__body">
        <strong>{title}</strong>
        <p>{children}</p>
        {progress === undefined ? null : (
          <progress
            aria-label={title}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            max={100}
            value={progress}
          >
            {progress}%
          </progress>
        )}
      </div>
      {dismissible ? (
        <button
          aria-label="안내 닫기"
          className="notice__dismiss"
          onClick={onDismiss}
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>
      ) : null}
    </div>
  )
}
