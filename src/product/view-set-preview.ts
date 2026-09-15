import { organizeVariableWorkspacePhotos } from "../domain/recovery"
import type { ViewId } from "../domain/types"
import type { ViewSet } from "../domain/view-set"
import { VIEW_LABELS, type WorkspacePhoto, type WorkspaceSourcePhoto } from "../domain/workspace"

// 설정에서 뷰 세트를 고르기 전에 "바꾸면 지금 사진이 어떻게 놓이는지"를 미리 보여준다
// (2026-09-03 bee: 설정을 바꿔도 변화를 느끼기 어렵다는 지적). 실제 전환과 같은 판정
// 함수를 같은 순서의 원본으로 돌리므로, 미리보기와 전환 결과는 항상 일치한다.
export type ViewSetPreview = {
  readonly filledViews: readonly ViewId[]
  readonly missingViews: readonly ViewId[]
  readonly sourceCount: number
  readonly spareCount: number
}

export function previewViewSetChange<TImage>(
  sources: readonly WorkspaceSourcePhoto<TImage>[],
  viewSet: ViewSet,
): ViewSetPreview {
  if (sources.length === 0) {
    return { filledViews: [], missingViews: viewSet.views, sourceCount: 0, spareCount: 0 }
  }
  const organized = organizeVariableWorkspacePhotos(sources, viewSet)
  const filled = new Set(organized.photos.map((photo) => photo.view))
  return {
    filledViews: viewSet.views.filter((view) => filled.has(view)),
    missingViews: viewSet.views.filter((view) => !filled.has(view)),
    sourceCount: sources.length,
    spareCount: organized.spares.length,
  }
}

// 지금 세트의 실제 상태(수동 이동이 반영된 배치본 기준). 미리보기와 같은 모양으로 만든다.
export function currentViewSetState<TImage>(
  photos: readonly WorkspacePhoto<TImage>[],
  spares: readonly WorkspaceSourcePhoto<TImage>[],
  viewSet: ViewSet,
): ViewSetPreview {
  const filled = new Set(photos.map((photo) => photo.view))
  return {
    filledViews: viewSet.views.filter((view) => filled.has(view)),
    missingViews: viewSet.views.filter((view) => !filled.has(view)),
    sourceCount: photos.length + spares.length,
    spareCount: spares.length,
  }
}

export function describeViewSetPreview(
  preview: ViewSetPreview,
  mode: "current" | "ifSwitched",
): string {
  if (preview.sourceCount === 0) {
    return "사진 없음 · 다음 정렬부터 이 구성으로 배치합니다"
  }
  const parts = [`${preview.filledViews.length}장 배치`]
  if (preview.missingViews.length > 0) {
    parts.push(
      `${preview.missingViews.length}개 뷰 미촬영 (${preview.missingViews
        .map((view) => VIEW_LABELS[view])
        .join(", ")})`,
    )
  }
  if (preview.spareCount > 0) {
    parts.push(`예비 ${preview.spareCount}장`)
  }
  return `${mode === "current" ? "지금" : "바꾸면"} ${parts.join(" · ")}`
}
