import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ComparisonExportDialog } from "./comparison-export-dialog"
import { ComparisonIntake } from "./comparison-intake"
import { useComparisonWorkspace } from "./use-comparison-workspace"
import { useGlobalFileDrop } from "./use-global-file-drop"
import type { WorkspaceStatus } from "./workspace"

type Props = { readonly active?: boolean; readonly onStatusChange: (status: WorkspaceStatus) => void }

export function ComparisonWorkspace({ active = true, onStatusChange }: Props) {
  const workspace = useComparisonWorkspace(undefined, active)
  const sessionStartedAt = useRef(Date.now())
  const [dropGuidance, setDropGuidance] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  useEffect(() => { if (!active) setExportOpen(false) }, [active])
  const explainGlobalDrop = useCallback(() => setDropGuidance("시술 전 또는 시술 후 칸에 사진 한 장씩 놓아주세요."), [])
  useGlobalFileDrop({ accepting: true, active, onFiles: explainGlobalDrop })
  const dirty = workspace.session.before.kind !== "empty" || workspace.session.after.kind !== "empty"
  const activity = useMemo(() => ({ kind: workspace.analysisSide !== null || workspace.exporting ? "busy" as const : "idle" as const, label: workspace.analysisSide !== null ? `전후 비교 분석 중 ${Math.round(workspace.progress)}%` : workspace.exporting ? "비교 이미지 저장 중" : dirty ? "전후 비교 작업 중" : "전후 사진 대기" }), [dirty, workspace.analysisSide, workspace.exporting, workspace.progress])
  useEffect(() => onStatusChange({ activity, dirty, exportCount: workspace.exportCount, exported: workspace.exported, privacyState: "localReady", reviewCount: 0, sessionStartedAt: sessionStartedAt.current }), [activity, dirty, onStatusChange, workspace.exportCount, workspace.exported])
  return <><ComparisonIntake active={active} angle={workspace.angle} angleOverride={workspace.angleOverride} angleResolution={workspace.angleResolution} displayOrder={workspace.exportSettings.order} onOrderChange={(order) => workspace.setExportSettings({ ...workspace.exportSettings, order })} analysisSide={workspace.analysisSide} analysisJourney={workspace.journey} before={workspace.session.before} after={workspace.session.after} canAnalyze={workspace.canAnalyze} canExport={workspace.canExport} exportMessage={exportOpen ? null : workspace.exportMessage} exported={workspace.exported} intakeMessage={dropGuidance} exporting={workspace.exporting} onAnalyze={() => void workspace.analyzePending()} onCancelAnalysis={workspace.cancelAnalysis} onAngleChange={workspace.setAngle} onExport={() => setExportOpen(true)} onRemove={workspace.removeSide} onReset={() => { setDropGuidance(null); setExportOpen(false); sessionStartedAt.current = Date.now(); workspace.reset() }} onReferenceChange={workspace.setReference} onReferencesChange={workspace.setReferences} onReferencePairApply={workspace.applyReferencePair} manualReferences={workspace.manualReferences} onResetReferences={workspace.resetReferences} onResidualChange={workspace.setResidual} onRetry={(side) => void workspace.retry(side)} onManual={workspace.beginManual} onSelect={(side, file) => { setDropGuidance(null); workspace.selectFile(side, file) }} progress={workspace.progress} renderModel={workspace.renderModel} eyePrivacy={workspace.eyePrivacy} embedded />
  <ComparisonExportDialog open={exportOpen && active} settings={workspace.exportSettings} busy={workspace.exporting} message={workspace.exportMessage} onChange={workspace.setExportSettings} onClose={() => setExportOpen(false)} onExport={() => void workspace.exportComparison()} /></>
}
