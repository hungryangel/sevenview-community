import { useEffect, useState } from "react"

type GlobalFileDropOptions = {
  readonly active?: boolean
  readonly accepting: boolean
  readonly onFiles: (files: readonly File[]) => void
}

// 첫 드롭 뒤에도 사진 교체와 추가가 가능하도록 파일 드래그를 앱 전역에서 받습니다.
// 파일을 받는 단계가 아니어도 preventDefault는 항상 걸어, 빗나간 드롭이
// 브라우저를 이미지 파일로 이동시켜
// 세션을 날리는 사고를 막는다. 반환값은 "지금 파일을 끌고 있음" 표시용.
export function useGlobalFileDrop({
  active = true,
  accepting,
  onFiles,
}: GlobalFileDropOptions): boolean {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!active) {
      setDragging(false)
      return undefined
    }
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files")
    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event) || event.defaultPrevented) {
        return
      }
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = accepting ? "copy" : "none"
      }
      setDragging(accepting)
    }
    const handleDrop = (event: DragEvent) => {
      setDragging(false)
      if (!hasFiles(event)) {
        return
      }
      if (event.defaultPrevented) {
        // 드롭존 등 개별 타깃이 이미 처리했다 — 이중 접수를 막는다.
        return
      }
      event.preventDefault()
      if (!accepting) {
        return
      }
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length > 0) {
        onFiles(files)
      }
    }
    const handleDragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) {
        setDragging(false)
      }
    }
    const handleDragEnd = () => setDragging(false)
    window.addEventListener("dragover", handleDragOver)
    window.addEventListener("drop", handleDrop)
    window.addEventListener("dragleave", handleDragLeave)
    window.addEventListener("dragend", handleDragEnd)
    return () => {
      window.removeEventListener("dragover", handleDragOver)
      window.removeEventListener("drop", handleDrop)
      window.removeEventListener("dragleave", handleDragLeave)
      window.removeEventListener("dragend", handleDragEnd)
    }
  }, [accepting, active, onFiles])

  return dragging
}
