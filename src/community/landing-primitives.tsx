import { ArrowRight } from "@phosphor-icons/react"
import type { ReactNode } from "react"

export function ActionLink({
  href,
  children,
  variant = "solid",
}: {
  readonly href: string
  readonly children: ReactNode
  readonly variant?: "solid" | "text"
}) {
  return (
    <a className={`sv-action sv-action--${variant}`} href={href}>
      <span>{children}</span>
      <ArrowRight size={20} aria-hidden="true" />
    </a>
  )
}

export function SectionIntro({
  number,
  title,
  description,
}: {
  readonly number: string
  readonly title: string
  readonly description?: string
}) {
  return (
    <div className="sv-intro">
      <p className="sv-eyebrow">{number}</p>
      <h2>{title}</h2>
      {description === undefined ? null : <p>{description}</p>}
    </div>
  )
}

export function ProductFigure({
  src,
  width,
  height,
  alt,
  caption,
  eager = false,
}: {
  readonly src: string
  readonly width: number
  readonly height: number
  readonly alt: string
  readonly caption: string
  readonly eager?: boolean
}) {
  return (
    <figure className="sv-figure">
      <img src={src} width={width} height={height} alt={alt} loading={eager ? "eager" : "lazy"} />
      <figcaption>{caption}</figcaption>
    </figure>
  )
}
