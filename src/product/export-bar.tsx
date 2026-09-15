import { ArrowRight, CheckCircle, DownloadSimple, WarningCircle } from "@phosphor-icons/react"
import "../styles/set-export-flow.css"

import { Button } from "../ui/button"
import type { UsageLedger } from "./usage-ledger"

type ExportBarProps = {
  readonly disabled: boolean
  readonly exportCount: number
  readonly exportedCurrentResult?: boolean
  readonly exportedThisSet?: boolean
  readonly exporting?: boolean
  readonly failedCount?: number
  readonly onOpenExport: () => void
  readonly onNextSet?: () => void
  readonly patientLabel: string
  readonly photoCount: number
  readonly reviewCount: number
  readonly sessionPhotoCount: number
  readonly totalViews: number
  readonly usage: UsageLedger
}

// 내보내기 바(2026-09-03 bee): 상태·사용량과 '내보내기' 버튼 하나만 둔다. 세션명·환자 라벨·
// 출력 선택·파일명은 버튼을 누르면 열리는 내보내기 대화상자에서 한 번에 정한다.
export function ExportBar({
  disabled,
  exportCount,
  exportedCurrentResult = false,
  exportedThisSet = false,
  exporting = false,
  failedCount = 0,
  onOpenExport,
  onNextSet,
  patientLabel,
  photoCount,
  reviewCount,
  sessionPhotoCount,
  totalViews,
  usage,
}: ExportBarProps) {
  const exportStatus = exporting
    ? "파일 생성 중"
    : exportedCurrentResult
      ? "다운로드 요청 완료"
      : exportedThisSet
        ? "변경됨 · 다시 내보내기"
        : "아직 내보내지 않음"
  return (
    <footer className="export-bar export-bar--set-flow">
      <div className="export-bar__status">
        <strong className="export-bar__receipt" role="status">
          {exportStatus}
        </strong>
        {reviewCount > 0 ? (
          <span className="export-bar__warning">
            <WarningCircle aria-hidden="true" size={18} weight="fill" /> 검토 필요 {reviewCount}장
          </span>
        ) : photoCount === totalViews ? (
          <span className="export-bar__complete">
            <CheckCircle aria-hidden="true" size={17} weight="fill" /> {totalViews}장 정렬 완료
          </span>
        ) : null}
        {photoCount === totalViews ? null : (
          <span className="export-bar__empty-note">
            {failedCount > 0
              ? `${photoCount}장 정렬 · 분석 실패 ${failedCount}장 · 사진 없음 ${totalViews - photoCount - failedCount}개`
              : `${photoCount}장 정렬 · ${totalViews - photoCount}개 뷰 미촬영`}
          </span>
        )}
        <small className="export-bar__caution">내보내기 전에 방향과 크롭을 확인하세요</small>
        {exportedCurrentResult ? (
          <small>다운로드 폴더에서 파일을 확인한 뒤 다음 세트를 시작하세요.</small>
        ) : null}
        <details className="export-bar__history">
          <summary>사용 기록</summary>
          <small className="export-bar__usage">
            이번 세션 정렬 {sessionPhotoCount}장 · 시트 PNG 내보내기 {exportCount}회 · 이 브라우저
            누적 {usage.sets}세트 {usage.photos}장 · 내보내기 {usage.exports}회
          </small>
        </details>
        {patientLabel === "" ? null : (
          // 환자 라벨이 파일명에 들어가는 동안은 대화상자를 닫아도 경고가 남아야 한다.
          <small className="export-bar__privacy-warning">
            다운로드 폴더의 클라우드 동기화 여부를 확인하세요
          </small>
        )}
      </div>
      <div className="export-bar__action">
        <Button disabled={disabled || exporting} onClick={onOpenExport} variant="primary">
          <DownloadSimple aria-hidden="true" size={19} /> 내보내기
        </Button>
        {exportedCurrentResult && onNextSet !== undefined ? (
          <Button disabled={disabled || exporting} onClick={onNextSet} variant="secondary">
            다음 세트 <ArrowRight aria-hidden="true" size={18} />
          </Button>
        ) : null}
      </div>
    </footer>
  )
}
