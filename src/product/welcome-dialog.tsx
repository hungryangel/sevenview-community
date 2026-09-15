import { X } from "@phosphor-icons/react"
import { useEffect, useRef } from "react"

import { Button } from "../ui/button"

type WelcomeDialogProps = {
  readonly onClose: () => void
  readonly onOpenPrivacy: () => void
  readonly open: boolean
  readonly version: string
}

export function WelcomeDialog({ onClose, onOpenPrivacy, open, version }: WelcomeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const dialog = dialogRef.current
    if (dialog === null) return undefined
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal()
      else dialog.setAttribute("open", "")
    }
    const handleClose = () => onClose()
    dialog.addEventListener("close", handleClose)
    return () => dialog.removeEventListener("close", handleClose)
  }, [onClose, open])

  if (!open) return null

  const closeDialog = () => {
    const dialog = dialogRef.current
    if (dialog !== null && typeof dialog.close === "function" && dialog.open) dialog.close()
    else onClose()
  }

  return (
    <dialog aria-labelledby="welcome-title" className="welcome-dialog" ref={dialogRef}>
      <div className="welcome-dialog__header">
        <p>SEVENVIEW COMMUNITY · v{version}</p>
        <button aria-label="환영 안내 닫기" onClick={closeDialog} type="button">
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="welcome-dialog__body">
        <h2 id="welcome-title">SevenView Community에 오신 것을 환영합니다</h2>
        <p className="welcome-dialog__thanks">의료 현장을 지켜 주시는 모든 분께 감사합니다.</p>
        <p>
          더 나은 근무 환경과 의료, 더 나은 세상을 만드는 데 작은 도움이 되도록 이 도구를 계속
          다듬겠습니다.
        </p>
        <section aria-labelledby="welcome-release-title">
          <h3 id="welcome-release-title">0.2.0 업데이트</h3>
          <p>방문·작업·내보내기 횟수 집계와 끄기 설정, 버전·즐겨찾기 안내를 추가했습니다.</p>
        </section>
        <section aria-labelledby="welcome-shortcut-title">
          <h3 id="welcome-shortcut-title">다시 찾기 쉽게 저장하세요</h3>
          <ul>
            <li>PC: Ctrl+D 또는 ⌘D로 즐겨찾기에 추가</li>
            <li>모바일: 브라우저 메뉴 또는 공유 메뉴에서 ‘홈 화면에 추가’ 선택</li>
          </ul>
        </section>
      </div>
      <div className="welcome-dialog__actions">
        <button className="welcome-dialog__privacy" onClick={onOpenPrivacy} type="button">
          사용 집계와 개인정보 안내
        </button>
        <Button onClick={closeDialog}>시작하기</Button>
      </div>
    </dialog>
  )
}
