import { DETECTION_QUALITY_LABELS, detectionQuality } from "../domain/detection-quality"
import { STANDARD_SEVEN_VIEW_DRAFT } from "../domain/protocol-preset"
import type { PoseMismatch } from "../domain/view-plausibility"
import { VIEW_LABELS } from "../domain/workspace"
import { Button } from "../ui/button"
import type { InspectorPanelProps } from "./inspector-panel"

// 수동 배치 감시 사유 — 확률 흉내가 아니라 측정값 기반의 판정 근거를 말로 쓴다.
const POSE_MISMATCH_REASONS: Record<PoseMismatch["kind"], string> = {
  not_lateral: "측정된 얼굴 방향이 정면대라, 측면·45도로 볼 만큼 돌아가 있지 않습니다.",
  wrong_side: "측정된 얼굴 방향이 반대쪽을 향하고 있습니다.",
  not_frontal: "측정된 얼굴 방향이 옆을 향하고 있습니다.",
  pitch_shallow: "위·아래 각도가 이 뷰만큼 기울어 있지 않습니다.",
  pitch_opposite: "위·아래 방향이 이 뷰와 반대입니다.",
  pitch_extreme: "정면으로 보기에는 위·아래 각도가 큽니다.",
}

export function InspectorReviewWarnings({
  hasLateralityConflict,
  onSwapLaterality,
  poseMismatch,
  photo,
  suggestedView,
  onAssignView,
  diagnostics,
  onDismissDiagnostic,
}: Pick<
  InspectorPanelProps,
  | "hasLateralityConflict"
  | "onSwapLaterality"
  | "poseMismatch"
  | "photo"
  | "suggestedView"
  | "onAssignView"
  | "diagnostics"
  | "onDismissDiagnostic"
>) {
  return (
    <>
      {" "}
      {hasLateralityConflict ? (
        <div className="inspector-panel__laterality-warning" role="alert">
          <strong>좌우 표기와 얼굴 방향이 다를 수 있습니다.</strong>
          <Button onClick={onSwapLaterality} variant="secondary">
            좌우 사진 교환
          </Button>
        </div>
      ) : null}
      {poseMismatch === null ? null : (
        <div className="inspector-panel__pose-warning" role="alert">
          <strong>이 사진은 '{VIEW_LABELS[photo.view]}' 각도로 보이지 않습니다.</strong>
          <p>
            {POSE_MISMATCH_REASONS[poseMismatch.kind]}
            {suggestedView === null || suggestedView === photo.view
              ? ""
              : ` 측정값 기준으로는 '${VIEW_LABELS[suggestedView]}'에 가깝습니다.`}
          </p>
          {suggestedView === null || suggestedView === photo.view ? null : (
            <Button onClick={() => onAssignView(suggestedView)} variant="secondary">
              '{VIEW_LABELS[suggestedView]}' 뷰로 보내기
            </Button>
          )}
        </div>
      )}
      {diagnostics.length === 0 ? null : (
        <section className="inspector-panel__diagnostics" aria-label="재촬영 권장 진단">
          {diagnostics.map((diagnostic) => (
            <div key={diagnostic.kind} role="alert">
              <div>
                <strong>재촬영 권장</strong>
                <p>{diagnostic.message}</p>
              </div>
              <button
                aria-label={`${diagnostic.kind} 재촬영 권장 닫기`}
                onClick={() => onDismissDiagnostic(diagnostic.kind)}
                type="button"
              >
                닫기
              </button>
            </div>
          ))}
        </section>
      )}
    </>
  )
}
export function InspectorPhotoDetails({
  framing,
  photo,
  sessionMemo,
  onSessionMemoChange,
}: Pick<InspectorPanelProps, "framing" | "photo" | "sessionMemo" | "onSessionMemoChange">) {
  return (
    <>
      <section className="inspector-panel__confidence" aria-label="기준점 감지 품질">
        <div>
          <span title="얼굴 기준점의 선명도입니다. 뷰 판정 확률이 아니며, 위치·회전 보정으로 바뀌지 않습니다.">
            기준점 감지
          </span>
          <strong
            className={`inspector-panel__confidence-value${
              photo.assignmentMethod !== "manual" &&
              detectionQuality(photo.view, photo.pose.confidence) === "weak"
                ? " inspector-panel__confidence-value--weak"
                : ""
            }`}
          >
            {photo.assignmentMethod === "manual"
              ? "수동 배치"
              : DETECTION_QUALITY_LABELS[detectionQuality(photo.view, photo.pose.confidence)]}
          </strong>
        </div>
        <small>
          {photo.assignmentMethod === "manual"
            ? "수동으로 지정한 사진입니다. 방향과 크롭을 직접 확인하세요."
            : detectionQuality(photo.view, photo.pose.confidence) === "weak"
              ? "기준점이 흐립니다. 얼굴이 작거나 흐릿할 수 있으니 방향과 크롭을 직접 확인하세요."
              : "자동 제안입니다. 방향과 크롭을 확인하세요."}
        </small>
      </section>
      <div className="inspector-panel__preset">
        <span>프로토콜 프리셋</span>
        <strong className="inspector-panel__preset-value">{STANDARD_SEVEN_VIEW_DRAFT.name}</strong>
        <small>크롭 프레이밍: {framing.label} · 좌우 표기 환자 기준 · 임상 확정 전 초안</small>
      </div>
      <label className="inspector-panel__memo">
        세션 메모
        <textarea
          aria-label="세션 메모"
          onChange={(event) => onSessionMemoChange(event.currentTarget.value)}
          placeholder="이 탭에서만 유지 · 시트 미포함 · 저장·전송 없음"
          rows={3}
          value={sessionMemo}
        />
      </label>
    </>
  )
}
