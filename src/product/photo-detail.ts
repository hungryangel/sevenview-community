import type { SessionPhotoMeta } from "../domain/session-mixup"
import type { WorkspacePhoto } from "../domain/workspace"
import { hasCropAdjustment } from "../domain/workspace"

export type PhotoDetailRow = {
  readonly label: string
  readonly value: string
}

function signed(value: number, digits: number): string {
  const rounded = Number(value.toFixed(digits))
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : ""
  return `${sign}${Math.abs(rounded).toFixed(digits)}`
}

function formatCaptureTime(captureTime: Date): string {
  return captureTime.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

// 타일 위 정보 팝업(2026-09-02 bee): 원본이 무엇이었고 자동·수동으로 얼마나 바뀌었는지를
// 한 장씩 보여준다. 파일명은 UI에 기록하지 않는다는 개인정보 문서의 약속대로 빼고,
// 카메라·촬영 시각·크기처럼 사람을 특정하지 않는 값만 쓴다.
export function describePhotoDetail(
  photo: WorkspacePhoto<unknown>,
  meta: SessionPhotoMeta | undefined,
): readonly PhotoDetailRow[] {
  const adjustment = photo.adjustment
  return [
    { label: "원본", value: `${photo.sourceSize.width} × ${photo.sourceSize.height} px` },
    { label: "카메라", value: meta?.camera ? meta.camera : "정보 없음" },
    {
      label: "촬영 시각",
      value: meta?.captureTime ? formatCaptureTime(meta.captureTime) : "정보 없음",
    },
    {
      label: "수동 보정",
      value: hasCropAdjustment(adjustment)
        ? `배율 ×${adjustment.scaleMultiplier.toFixed(2)} · 이동 ${signed(adjustment.panX * 100, 0)}% / ${signed(adjustment.panY * 100, 0)}% · 회전 ${signed(adjustment.rotationDegrees, 1)}°`
        : "없음",
    },
  ]
}
