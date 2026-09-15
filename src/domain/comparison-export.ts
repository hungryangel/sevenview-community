import { sanitizeFilenameSegment } from "./session-export"

export type ComparisonExportSelection = {
  readonly png: boolean
  readonly individualPngs: boolean
  readonly pdf: boolean
  readonly pptx: boolean
  readonly html: boolean
}

export type ComparisonExportOrder = "beforeAfter" | "afterBefore"
export type ComparisonExportSlot = "before" | "after"

export type ComparisonExportSettings = {
  readonly sessionName: string
  readonly selection: ComparisonExportSelection
  readonly order: ComparisonExportOrder
}

export const DEFAULT_COMPARISON_EXPORT_SELECTION = {
  png: true,
  individualPngs: false,
  pdf: false,
  pptx: false,
  html: false,
} as const satisfies ComparisonExportSelection

export const COMPARISON_EXPORT_LABELS = { before: "시술 전", after: "시술 후" } as const

export const COMPARISON_EXPORT_SLOTS = {
  beforeAfter: ["before", "after"],
  afterBefore: ["after", "before"],
} as const satisfies Record<ComparisonExportOrder, readonly ComparisonExportSlot[]>

export function createComparisonExportSettings(sessionName: string): ComparisonExportSettings {
  return { sessionName, selection: DEFAULT_COMPARISON_EXPORT_SELECTION, order: "beforeAfter" }
}

export function countComparisonExportArtifacts(selection: ComparisonExportSelection): number {
  return (
    Number(selection.png) +
    Number(selection.pdf) +
    Number(selection.pptx) +
    Number(selection.html) +
    (selection.individualPngs ? 2 : 0)
  )
}

export function hasComparisonExportOutput(selection: ComparisonExportSelection): boolean {
  return countComparisonExportArtifacts(selection) > 0
}

export function buildComparisonArtifactFilename(
  sessionName: string,
  extension: "png" | "pdf" | "pptx" | "html" | "zip",
): string {
  return `${sanitizeFilenameSegment(sessionName) || "sevenview"}_before-after.${extension}`
}

export function buildComparisonExportFilename(settings: ComparisonExportSettings): string {
  const { selection } = settings
  const extension =
    countComparisonExportArtifacts(selection) > 1
      ? "zip"
      : selection.pdf
        ? "pdf"
        : selection.pptx
          ? "pptx"
          : selection.html
            ? "html"
            : "png"
  return buildComparisonArtifactFilename(settings.sessionName, extension)
}

export function buildComparisonIndividualFilename(
  settings: ComparisonExportSettings,
  slot: ComparisonExportSlot,
): string {
  const index = COMPARISON_EXPORT_SLOTS[settings.order].indexOf(slot) + 1
  const name = sanitizeFilenameSegment(settings.sessionName) || "sevenview"
  return `${name}_${String(index).padStart(2, "0")}_${slot}.png`
}
