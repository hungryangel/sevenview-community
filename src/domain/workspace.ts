import type {
  ClassicSevenViewId,
  CropAdjustment,
  ImageSize,
  PhotoPose,
  SevenViewAssignment,
  ViewId,
} from "./types"
import { CLASSIC_SEVEN_VIEW_IDS, VIEW_IDS } from "./types"

export const VIEW_LABELS = {
  front: "정면",
  frontSmile: "정면 스마일",
  rightOblique: "우측 45도",
  leftOblique: "좌측 45도",
  rightProfile: "우측 측면",
  leftProfile: "좌측 측면",
  chinUp: "아래 (턱 밑)",
  crownDown: "위 (정수리)",
} as const satisfies Record<ViewId, string>

export const DEFAULT_CROP_ADJUSTMENT: CropAdjustment = {
  panX: 0,
  panY: 0,
  rotationDegrees: 0,
  scaleMultiplier: 1,
}

// 검토자가 그리드에서 "손댄 사진"을 구분할 수 있게 하는 판정(타일 '보정됨' 배지).
export function hasCropAdjustment(adjustment: CropAdjustment): boolean {
  return (
    adjustment.panX !== DEFAULT_CROP_ADJUSTMENT.panX ||
    adjustment.panY !== DEFAULT_CROP_ADJUSTMENT.panY ||
    adjustment.rotationDegrees !== DEFAULT_CROP_ADJUSTMENT.rotationDegrees ||
    adjustment.scaleMultiplier !== DEFAULT_CROP_ADJUSTMENT.scaleMultiplier
  )
}

export type WorkspaceSourcePhoto<TImage> = {
  readonly image: TImage
  readonly pose: PhotoPose
  readonly sourceSize: ImageSize
}

export type WorkspacePhoto<TImage> = WorkspaceSourcePhoto<TImage> & {
  readonly adjustment: CropAdjustment
  readonly assignmentMethod: "auto" | "manual"
  readonly view: ViewId
}

export type LateralityConflict = {
  readonly actualYawScore: number
  readonly expectedDirection: -1 | 1
  readonly view: "rightOblique" | "leftOblique" | "rightProfile" | "leftProfile"
}

const LATERALITY_DIRECTION = {
  rightOblique: 1,
  leftOblique: -1,
  rightProfile: 1,
  leftProfile: -1,
} as const satisfies Record<LateralityConflict["view"], -1 | 1>

const LATERALITY_PAIR = {
  rightOblique: "leftOblique",
  leftOblique: "rightOblique",
  rightProfile: "leftProfile",
  leftProfile: "rightProfile",
} as const satisfies Record<LateralityConflict["view"], LateralityConflict["view"]>

const LATERALITY_WARNING_THRESHOLD = 0.06

export class WorkspacePhotoError extends Error {
  readonly name = "WorkspacePhotoError"

  constructor(readonly missingPhotoId: string) {
    super(`Analyzed photo is missing: ${missingPhotoId}`)
  }
}

function sourceFor<TImage>(
  photos: readonly WorkspaceSourcePhoto<TImage>[],
  photoId: string,
): WorkspaceSourcePhoto<TImage> {
  const photo = photos.find((candidate) => candidate.pose.id === photoId)
  if (photo === undefined) {
    throw new WorkspacePhotoError(photoId)
  }
  return photo
}

function assignedPhotoId(assignment: SevenViewAssignment, view: ClassicSevenViewId): string {
  return assignment[view]
}

function viewAt(index: number): ViewId {
  const view = CLASSIC_SEVEN_VIEW_IDS[index]
  if (view === undefined) {
    throw new WorkspacePhotoError(`slot-${index}`)
  }
  return view
}

export function organizeWorkspacePhotos<TImage>(
  photos: readonly WorkspaceSourcePhoto<TImage>[],
  assignment: SevenViewAssignment,
): readonly WorkspacePhoto<TImage>[] {
  return CLASSIC_SEVEN_VIEW_IDS.map((view) => ({
    ...sourceFor(photos, assignedPhotoId(assignment, view)),
    adjustment: DEFAULT_CROP_ADJUSTMENT,
    assignmentMethod: "auto",
    view,
  }))
}

function photoForView<TImage>(
  photos: readonly WorkspacePhoto<TImage>[],
  view: ViewId,
): WorkspacePhoto<TImage> {
  const photo = photos.find((candidate) => candidate.view === view)
  if (photo === undefined) {
    throw new WorkspacePhotoError(view)
  }
  return photo
}

export function assignWorkspacePhotoToView<TImage>(
  photos: readonly WorkspacePhoto<TImage>[],
  sourceView: ViewId,
  targetView: ViewId,
): readonly WorkspacePhoto<TImage>[] {
  if (sourceView === targetView) {
    return photos
  }

  const source = photoForView(photos, sourceView)
  const target = photos.find((candidate) => candidate.view === targetView)

  // 대상 뷰가 미촬영이면 맞바꿀 상대가 없다 — 사진만 옮기고 원래 자리는 비운다.
  // (맞교환 전제로 짜였던 이전 버전은 여기서 던져서 버튼이 조용히 무시됐다.)
  if (target === undefined) {
    return photos
      .filter((photo) => photo.view !== sourceView)
      .concat({ ...source, assignmentMethod: "manual", view: targetView })
  }

  return photos.map((photo) => {
    if (photo.view === sourceView) {
      return { ...target, view: sourceView }
    }
    if (photo.view === targetView) {
      return { ...source, assignmentMethod: "manual", view: targetView }
    }
    return photo
  })
}

function isLateralityView(view: ViewId): view is LateralityConflict["view"] {
  return view in LATERALITY_DIRECTION
}

export function findLateralityConflicts<TImage>(
  photos: readonly WorkspacePhoto<TImage>[],
): readonly LateralityConflict[] {
  return VIEW_IDS.flatMap((view) => {
    if (!isLateralityView(view)) {
      return []
    }
    const photo = photos.find((candidate) => candidate.view === view)
    if (photo === undefined) {
      return []
    }
    const expectedDirection = LATERALITY_DIRECTION[view]
    const contradictory = photo.pose.yawScore * expectedDirection < -LATERALITY_WARNING_THRESHOLD
    return contradictory ? [{ actualYawScore: photo.pose.yawScore, expectedDirection, view }] : []
  })
}

export function swapLateralityPair<TImage>(
  photos: readonly WorkspacePhoto<TImage>[],
  view: ViewId,
): readonly WorkspacePhoto<TImage>[] {
  if (!isLateralityView(view)) {
    return photos
  }

  const pairedView = LATERALITY_PAIR[view]
  const source = photoForView(photos, view)
  const target = photoForView(photos, pairedView)

  return photos.map((photo) => {
    if (photo.view === view) {
      return { ...target, assignmentMethod: "manual", view }
    }
    if (photo.view === pairedView) {
      return { ...source, assignmentMethod: "manual", view: pairedView }
    }
    return photo
  })
}

export function reorderWorkspacePhotos<TImage>(
  photos: readonly WorkspacePhoto<TImage>[],
  fromIndex: number,
  direction: -1 | 1,
): readonly WorkspacePhoto<TImage>[] {
  const toIndex = fromIndex + direction
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= photos.length || toIndex >= photos.length) {
    return photos
  }

  return photos.map((_, index) => {
    const sourceIndex = index === fromIndex ? toIndex : index === toIndex ? fromIndex : index
    const source = photos[sourceIndex]
    if (source === undefined) {
      throw new WorkspacePhotoError(`slot-${sourceIndex}`)
    }
    return { ...source, view: viewAt(index) }
  })
}

export function reorderViewSequence(
  sequence: readonly ViewId[],
  sourceView: ViewId,
  targetView: ViewId,
): readonly ViewId[] {
  const sourceIndex = sequence.indexOf(sourceView)
  const targetIndex = sequence.indexOf(targetView)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return sequence
  }

  const next = [...sequence]
  next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, sourceView)
  return next
}

export function resetWorkspaceAdjustments<TImage>(
  photos: readonly WorkspacePhoto<TImage>[],
): readonly WorkspacePhoto<TImage>[] {
  return photos.map((photo) => ({ ...photo, adjustment: DEFAULT_CROP_ADJUSTMENT }))
}
