import { createContext, type ReactNode, useContext } from "react"
import { createPortal } from "react-dom"

export const WorkspaceHeaderHost = createContext<HTMLElement | null | undefined>(undefined)

/** Projects an active workspace's action without moving its session or confirmation state. */
export function WorkspaceHeaderAction({
  active,
  children,
}: {
  readonly active: boolean
  readonly children: ReactNode
}) {
  const host = useContext(WorkspaceHeaderHost)
  if (!active || host === null) return null
  return host === undefined ? children : createPortal(children, host)
}
