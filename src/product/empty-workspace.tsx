import {
  ArrowCounterClockwise,
  Eye,
  LockKey,
  MagicWand,
  Plus,
  X,
} from "@phosphor-icons/react"
import { useRef } from "react"

import { type AnalysisJourney, beginAnalysisJourney } from "../domain/analysis-journey"
import { Button } from "../ui/button"
import { DropZone, type DropZoneState } from "../ui/drop-zone"
import { Notice } from "../ui/notice"
import { AnalysisStage } from "./analysis-stage"
import type { WorkspaceMessage, WorkspacePhase } from "./use-workspace"

export type PendingAnalysisFile = {
  readonly name: string
  readonly previewUrl: string
}

type EmptyWorkspaceProps = {
  readonly active?: boolean
  readonly analysisJourney?: AnalysisJourney
  readonly compact: boolean
  readonly dropZoneState: DropZoneState
  readonly message: WorkspaceMessage | null
  readonly onAppendFiles: (files: readonly File[]) => void
  readonly onCancelAnalysis?: () => void
  readonly onFiles: (files: readonly File[]) => void
  // 사용 안내(가이드 대화상자)를 첫 화면에서도 바로 연다(2026-09-03 bee: 안내 링크를 따로 보내지 않게).
  readonly onOpenGuide: () => void
  readonly onRemovePendingFile: (index: number) => void
  readonly onStartAnalysis: () => void
  readonly pendingFiles: readonly PendingAnalysisFile[]
  readonly phase: WorkspacePhase
  readonly progress?: number
  readonly receivingDrop: boolean
  readonly embedded?: boolean
}

// 접수창(2026-09-03 bee, UI 2단계): 랜딩 페이지가 아니라 도구의 첫 화면이다. 큼직한 헤드라인과
// 장식 아이콘을 빼고, 제목 한 줄·설명 한 줄·드롭존·샘플·보장 3줄만 남긴다.
export function EmptyWorkspace({
  active = true,
  analysisJourney = beginAnalysisJourney(0, 0),
  compact,
  dropZoneState,
  message,
  onAppendFiles,
  onCancelAnalysis = () => undefined,
  onFiles,
  onOpenGuide,
  onRemovePendingFile,
  onStartAnalysis,
  pendingFiles,
  phase,
  receivingDrop,
  embedded = false,
}: EmptyWorkspaceProps) {
  const analyzing = phase === "analyzing"
  const awaitingAnalysis = phase === "awaitingAnalysis"
  const appendInputRef = useRef<HTMLInputElement>(null)

  const Root = embedded ? "section" : "main"
  return (
    <Root
      className={`empty-workspace${compact ? " empty-workspace--compact" : ""}`}
      id={embedded ? undefined : "main-content"}
    >
      <header className="empty-workspace__intro">
        <h1 id={embedded ? "seven-view-heading" : "empty-title"} tabIndex={-1}>
          {compact ? "다음 세트 접수" : "사진 접수"}
        </h1>
        <p>
          임상 사진을 넣으면 얼굴 기준점을 이 기기 안에서 분석해 4:5 크롭과 컨택트 시트를 만듭니다.
          1~12장, 순서는 상관없습니다.
        </p>
      </header>

      <div className="empty-workspace__input">
        {awaitingAnalysis || analyzing ? (
          analyzing ? (
            <AnalysisStage
              active={active}
              files={pendingFiles}
              journey={analysisJourney}
              onCancel={onCancelAnalysis}
            />
          ) : (
            <section
              aria-labelledby="pending-analysis-title"
              className={`pending-analysis${receivingDrop ? " pending-analysis--receiving" : ""}`}
            >
              <div>
                <span className="eyebrow">분석 대기</span>
                <h2 id="pending-analysis-title">원본 {pendingFiles.length}장을 준비했습니다</h2>
                <p>
                  {receivingDrop
                    ? "여기에 놓으면 지금 세트에 추가됩니다."
                    : "AI 자동 정렬을 누르면 이 기기 안에서만 분석을 시작합니다."}
                </p>
              </div>
              <ul aria-label="분석 대기 원본 사진">
                {pendingFiles.map((file, index) => (
                  <li key={file.previewUrl}>
                    <img alt={`${index + 1}번 원본 썸네일`} src={file.previewUrl} />
                    <span>{index + 1}</span>
                    <button
                      aria-label={`${index + 1}번 사진 빼기`}
                      className="pending-analysis__remove"
                      onClick={() => onRemovePendingFile(index)}
                      type="button"
                    >
                      <X aria-hidden="true" size={14} weight="bold" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="pending-analysis__actions">
                <input
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  multiple
                  onChange={(event) => {
                    onAppendFiles(Array.from(event.target.files ?? []))
                    event.target.value = ""
                  }}
                  ref={appendInputRef}
                  type="file"
                />
                <Button
                  className="button--glow"
                  disabled={pendingFiles.length === 0}
                  onClick={onStartAnalysis}
                  variant="primary"
                >
                  <MagicWand aria-hidden="true" size={18} /> AI 자동 정렬
                </Button>
                <Button
                  disabled={pendingFiles.length >= 12}
                  onClick={() => appendInputRef.current?.click()}
                  variant="quiet"
                >
                  <Plus aria-hidden="true" size={16} /> 사진 추가 ({pendingFiles.length}/12)
                </Button>
                <span className="pending-analysis__drop-hint">
                  사진을 이 화면 아무 데나 끌어다 놓아도 추가됩니다
                </span>
              </div>
              <p className="pending-analysis__warning">
                정렬이 끝나면 내보내기 전에 방향과 크롭을 한 번 확인할 수 있습니다
              </p>
            </section>
          )
        ) : (
          <DropZone disabled={analyzing} onFiles={onFiles} state={dropZoneState} />
        )}
        {message === null ? null : (
          <Notice kind={message.kind} title={message.title}>
            {message.text}
          </Notice>
        )}
        <div className="empty-workspace__help">
          <span>촬영 방향과 지원 형식은 사용 안내에서 확인할 수 있습니다.</span>
          <Button onClick={onOpenGuide} variant="quiet">
            사용 안내
          </Button>
        </div>
      </div>

      {compact ? null : (
        // 장점을 말하는 문구(2026-09-03 bee: 방어적 설명이 아니라 홍보 문구로). 단, 사실 범위는 지킨다 —
        // 사진은 브라우저 밖으로 나가지 않고, 결과는 내 컴퓨터에 내려받기로만 저장된다.
        <ul className="empty-workspace__assurances" aria-label="장점">
          <li>
            <LockKey aria-hidden="true" size={18} />
            <span>
              <strong>외부 유출 없음</strong>
              <small>사진은 이 브라우저 안에서만 처리되고, 결과는 내 컴퓨터에만 저장됩니다</small>
            </span>
          </li>
          <li>
            <ArrowCounterClockwise aria-hidden="true" size={18} />
            <span>
              <strong>안전한 원본 보존</strong>
              <small>원본 파일은 그대로 두고 정렬본을 새 파일로 만듭니다</small>
            </span>
          </li>
          <li>
            <Eye aria-hidden="true" size={18} />
            <span>
              <strong>AI 검토 보조</strong>
              <small>AI가 7뷰를 먼저 정렬하고, 필요한 곳만 빠르게 손봅니다</small>
            </span>
          </li>
        </ul>
      )}
    </Root>
  )
}
