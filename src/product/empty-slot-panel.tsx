import { ImageSquare } from "@phosphor-icons/react"
import { useRef } from "react"

import type { ViewId } from "../domain/types"
import { VIEW_LABELS } from "../domain/workspace"
import { Button } from "../ui/button"

type EmptySlotPanelProps = {
  readonly onAddPhoto: (file: File) => void
  readonly view: ViewId
}

export function EmptySlotPanel({ onAddPhoto, view }: EmptySlotPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <aside className="inspector-panel empty-slot-panel" aria-labelledby="empty-slot-title">
      <div className="panel-heading">
        <span>선택한 뷰</span>
        <strong id="empty-slot-title">{VIEW_LABELS[view]}</strong>
      </div>
      <div className="empty-slot-panel__body">
        <ImageSquare aria-hidden="true" size={28} />
        <p>
          이 뷰는 미촬영 상태입니다. 이대로 내보내면 시트에 미촬영으로 표시되고, 아래에서 사진을
          추가해 채울 수도 있습니다.
        </p>
      </div>
      <input
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file !== undefined) {
            onAddPhoto(file)
          }
          event.target.value = ""
        }}
        ref={inputRef}
        type="file"
      />
      <Button onClick={() => inputRef.current?.click()} variant="quiet">
        이 뷰에 사진 추가
      </Button>
    </aside>
  )
}
