import { X } from "@phosphor-icons/react"
import { type ReactNode, type Ref, useEffect, useRef, useState } from "react"
import { Button } from "../ui/button"

export const INSPECTOR_SURFACE_ID = "workspace-inspector"

type InspectorSurfaceProps = {
  readonly children: ReactNode
  readonly noticeHostRef?: Ref<HTMLDivElement>
  readonly onClose: () => void
  readonly onNext: (() => void) | null
  readonly onPrevious: (() => void) | null
}

export function InspectorSurface({
  children,
  noticeHostRef,
  onClose,
  onNext,
  onPrevious,
}: InspectorSurfaceProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const surfaceRef = useRef<HTMLElement>(null)
  const [modal, setModal] = useState(() => window.innerWidth < 1024)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    const updateModal = () => setModal(window.innerWidth < 1024)
    window.addEventListener("resize", updateModal)
    return () => window.removeEventListener("resize", updateModal)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const eventElement = event.target instanceof Element ? event.target : document.activeElement
      const activeDialog =
        eventElement instanceof Element
          ? eventElement.closest<HTMLElement>('[role="dialog"], [role="alertdialog"], dialog[open]')
          : null
      const surface = surfaceRef.current
      if (activeDialog !== null && activeDialog !== surface) {
        return
      }
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (modal && event.key === "Tab") {
        const surface = surfaceRef.current
        if (surface === null) {
          return
        }
        const focusable = [
          ...surface.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ]
        const heading = headingRef.current
        const firstControl = focusable.at(0)
        const lastControl = focusable.at(-1)
        if (event.shiftKey && document.activeElement === heading) {
          event.preventDefault()
          lastControl?.focus()
        } else if (event.shiftKey && document.activeElement === firstControl) {
          event.preventDefault()
          heading?.focus()
        } else if (!event.shiftKey && document.activeElement === lastControl) {
          event.preventDefault()
          heading?.focus()
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [modal, onClose])

  useEffect(() => {
    const background = new Set<HTMLElement>()
    let foreground: Element | null = modal ? surfaceRef.current : null
    while (foreground !== null) {
      const parent = foreground.parentElement
      if (parent === null) break
      for (const element of parent.children) {
        if (
          element instanceof HTMLElement &&
          element !== foreground &&
          !element.inert &&
          !element.hasAttribute("inert") &&
          !element.classList.contains("inspector-surface__scrim")
        ) {
          background.add(element)
          element.inert = true
        }
      }
      if (parent.classList.contains("app-shell") || parent === document.body) break
      foreground = parent
    }
    const surface = surfaceRef.current
    if (
      modal &&
      surface !== null &&
      document.activeElement instanceof Element &&
      !surface.contains(document.activeElement)
    ) {
      headingRef.current?.focus()
    }
    return () => {
      for (const element of background) {
        element.inert = false
      }
    }
  }, [modal])

  return (
    <>
      <button
        aria-label="세부 조정 닫기"
        className="inspector-surface__scrim"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-labelledby="inspector-surface-title"
        aria-modal={modal || undefined}
        className="inspector-surface"
        id={INSPECTOR_SURFACE_ID}
        ref={surfaceRef}
        role="dialog"
      >
        <header className="inspector-surface__header">
          <h2 id="inspector-surface-title" ref={headingRef} tabIndex={-1}>
            세부 조정
          </h2>
          <Button aria-label="세부 조정 닫기" onClick={onClose} variant="quiet">
            <X aria-hidden="true" size={18} /> 닫기
          </Button>
        </header>
        {onPrevious !== null || onNext !== null ? (
          <div className="inspector-surface__navigation">
            <Button
              disabled={onPrevious === null}
              onClick={onPrevious ?? undefined}
              variant="quiet"
            >
              이전 검토
            </Button>
            <Button disabled={onNext === null} onClick={onNext ?? undefined} variant="quiet">
              다음 검토
            </Button>
          </div>
        ) : null}
        <div className="inspector-surface__notice" ref={noticeHostRef} />
        {children}
      </section>
    </>
  )
}
