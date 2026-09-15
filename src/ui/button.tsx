import { SpinnerGap } from "@phosphor-icons/react"
import type { ComponentProps, ReactNode } from "react"

type ButtonVariant = "primary" | "secondary" | "quiet" | "destructive"

// 네이티브 button 속성(aria-*·ref 포함)을 그대로 통과시킨다. TypeScript는 하이픈이 든
// JSX 속성을 검사하지 않아, 여기서 스프레드하지 않으면 aria-pressed 같은 상태가
// 조용히 사라진다(2026-09-01 실측 결함).
type ButtonProps = ComponentProps<"button"> & {
  readonly children: ReactNode
  readonly loading?: boolean
  readonly variant?: ButtonVariant
}

export function Button({
  children,
  className = "",
  disabled = false,
  loading = false,
  type = "button",
  variant = "secondary",
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      {...buttonProps}
      aria-busy={loading}
      className={`button button--${variant} ${className}`.trim()}
      disabled={disabled || loading}
      type={type}
    >
      {loading ? <SpinnerGap aria-hidden="true" className="button__spinner" size={18} /> : null}
      {/* 아이콘+글자를 한 줄에 가운데 정렬 — 인라인 SVG의 baseline 정렬이 아이콘을 살짝 띄우던
          문제(2026-09-03 bee 지적)를 flex 정렬로 없앤다. */}
      <span className="button__label">{children}</span>
    </button>
  )
}
