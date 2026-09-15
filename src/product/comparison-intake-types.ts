import type { AnalysisJourney } from "../domain/analysis-journey"
import type { ComparisonAngle, ComparisonSide } from "../domain/comparison"
import type { ComparisonAngleResolution } from "../domain/comparison-angle"
import type { ComparisonExportOrder } from "../domain/comparison-export"
import type { ComparisonReferencePair } from "../domain/comparison-reference-pair"
import type { RegistrationReferences } from "../domain/comparison-registration"
import type { ComparisonSlot } from "../domain/comparison-session"
import type { CropAdjustment, Point } from "../domain/types"
import type { ComparisonEditablePair } from "./comparison-editable-pair"
import type { ComparisonRenderModel, ManualComparisonReferences } from "./comparison-render-model"
import type { ComparisonEyePrivacyController } from "./use-comparison-eye-privacy"

export type ComparisonIntakeProps = {
  readonly active?: boolean
  readonly angle: ComparisonAngle
  readonly angleOverride?: ComparisonAngle | null
  readonly angleResolution?: ComparisonAngleResolution | null
  readonly displayOrder?: ComparisonExportOrder
  readonly onOrderChange?: (order: ComparisonExportOrder) => void
  readonly analysisSide?: ComparisonSide | null
  readonly analysisJourney?: AnalysisJourney
  readonly before: ComparisonSlot<CanvasImageSource>
  readonly after: ComparisonSlot<CanvasImageSource>
  readonly canAnalyze: boolean
  readonly canExport: boolean
  readonly exportMessage: string | null
  readonly exported?: boolean
  readonly exporting: boolean
  readonly intakeMessage?: string | null
  readonly embedded?: boolean
  readonly onAnalyze: () => void
  readonly onCancelAnalysis?: () => void
  readonly onAngleChange: (angle: ComparisonAngle | null) => void
  readonly onExport: () => void
  readonly onRemove: (side: ComparisonSide) => void
  readonly onReset?: () => void
  readonly onRetry: (side: ComparisonSide) => void
  readonly onManual?: (side: ComparisonSide) => void
  readonly onSelect: (side: ComparisonSide, file: File) => void
  readonly progress: number
  readonly renderModel?: ComparisonRenderModel | null
  readonly eyePrivacy?: ComparisonEyePrivacyController
  readonly manualReferences?: ManualComparisonReferences
  readonly onReferencePairApply?: (
    pair: ComparisonEditablePair,
    references: ComparisonReferencePair,
    angle: ComparisonAngle,
  ) => boolean
  readonly onReferenceChange?: (
    side: ComparisonSide,
    index: "first" | "second",
    point: Point,
  ) => void
  readonly onReferencesChange?: (side: ComparisonSide, references: RegistrationReferences) => void
  readonly onResetReferences?: () => void
  readonly onResidualChange?: (adjustment: CropAdjustment) => void
}
