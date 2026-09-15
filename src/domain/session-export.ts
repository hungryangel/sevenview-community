export type ContactSheetExportedEvent = {
  readonly occurredAt: number
  readonly sessionName: string
  readonly type: "contact_sheet_exported"
}

export type ExportSelection = {
  readonly contactSheet: boolean
  readonly individualPngs: boolean
  // 2026-09-03: 컨택트 시트를 PDF 한 페이지 / PPT 슬라이드 한 장으로도 내보낸다.
  readonly pdf: boolean
  readonly pptx: boolean
}

export const DEFAULT_EXPORT_SELECTION: ExportSelection = {
  contactSheet: true,
  individualPngs: false,
  pdf: false,
  pptx: false,
}

// 선택된 출력이 만들어 내는 파일 수. 2개 이상이면 ZIP 하나로 내려받는다.
export function countExportArtifacts(selection: ExportSelection, photoCount: number): number {
  return (
    (selection.contactSheet ? 1 : 0) +
    (selection.pdf ? 1 : 0) +
    (selection.pptx ? 1 : 0) +
    (selection.individualPngs ? photoCount : 0)
  )
}

export function hasExportOutput(selection: ExportSelection): boolean {
  return selection.contactSheet || selection.individualPngs || selection.pdf || selection.pptx
}

export type DownloadFilenameInput = {
  readonly patientLabel: string
  readonly sessionName: string
}

export type IndividualViewFilenameInput = DownloadFilenameInput & {
  readonly index: number
  readonly viewLabel: string
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

export function createDefaultSessionName(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
}

export function buildComparisonFilename(now: Date): string {
  return `sevenview-before-after-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.png`
}

export function sanitizeFilenameSegment(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function filenameParts({ patientLabel, sessionName }: DownloadFilenameInput): readonly string[] {
  const safeSessionName = sanitizeFilenameSegment(sessionName) || "sevenview"
  const safePatientLabel = sanitizeFilenameSegment(patientLabel)
  return safePatientLabel === "" ? [safeSessionName] : [safeSessionName, safePatientLabel]
}

export function buildContactSheetFilename(input: DownloadFilenameInput): string {
  return [...filenameParts(input), "contact-sheet.png"].join("_")
}

export function buildContactSheetPdfFilename(input: DownloadFilenameInput): string {
  return [...filenameParts(input), "contact-sheet.pdf"].join("_")
}

export function buildContactSheetPptxFilename(input: DownloadFilenameInput): string {
  return [...filenameParts(input), "contact-sheet.pptx"].join("_")
}

// 파일이 둘 이상인 내보내기는 항상 ZIP 하나로 내려받는다(다중 다운로드 차단 회피).
export function buildExportBundleFilename(input: DownloadFilenameInput): string {
  return [...filenameParts(input), "sevenview.zip"].join("_")
}

export function buildIndividualViewFilename({
  index,
  viewLabel,
  ...input
}: IndividualViewFilenameInput): string {
  const safeViewLabel = sanitizeFilenameSegment(viewLabel) || "view"
  return [...filenameParts(input), String(index), `${safeViewLabel}.png`].join("_")
}

export function createContactSheetExportedEvent(sessionName: string): ContactSheetExportedEvent {
  return {
    occurredAt: Date.now(),
    sessionName,
    type: "contact_sheet_exported",
  }
}

export function countContactSheetExports(events: readonly ContactSheetExportedEvent[]): number {
  return events.filter((event) => event.type === "contact_sheet_exported").length
}
