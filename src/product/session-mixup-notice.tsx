import type { SessionMixupSignal } from "../domain/session-mixup"
import { Notice } from "../ui/notice"

type SessionMixupNoticeProps = {
  readonly onDismiss: () => void
  readonly signals: readonly SessionMixupSignal[]
}

function signalLine(signal: SessionMixupSignal): string {
  switch (signal.kind) {
    case "time_gap":
      return `촬영 시각이 ${signal.maxGapMinutes}분 떨어진 사진이 있습니다.`
    case "camera_mismatch":
      return `서로 다른 카메라(${signal.cameras.join(", ")})의 사진이 섞여 있습니다.`
    case "sequence_gap":
      return "파일 번호가 크게 건너뛴 사진이 있습니다."
  }
}

export function SessionMixupNotice({ onDismiss, signals }: SessionMixupNoticeProps) {
  if (signals.length === 0) {
    return null
  }
  return (
    <Notice
      dismissible
      kind="warning"
      onDismiss={onDismiss}
      title="다른 환자나 다른 촬영의 사진이 섞이지 않았는지 확인하세요"
    >
      {signals.map((signal) => (
        <span className="session-mixup-notice__line" key={signal.kind}>
          {signalLine(signal)}
        </span>
      ))}
      <span className="session-mixup-notice__limit">
        표시된 슬롯의 사진을 교체하거나 직접 확인하세요. 연속으로 촬영된 다른 환자는 이 경고로
        잡히지 않을 수 있습니다.
      </span>
    </Notice>
  )
}
