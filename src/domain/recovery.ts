import type { AnalysisFailureCode, ImageSize, PhotoId, ViewId } from "./types"
import {
  chinUpQualifies,
  crownDownQualifies,
  FRONT_MAX_PITCH_DELTA,
  isConfidentProfile,
  isDistinctLateralPose,
  isFrontalBand,
  isLateralCandidate,
  setPitchMedian,
} from "./view-plausibility"
import { VIEW_SETS, type ViewSet, viewSetIncludes } from "./view-set"
import {
  DEFAULT_CROP_ADJUSTMENT,
  type WorkspacePhoto,
  type WorkspaceSourcePhoto,
} from "./workspace"

export type { WorkspaceSourcePhoto } from "./workspace"

export type WorkspaceFailure<TImage> = {
  readonly code: AnalysisFailureCode
  readonly decoded: { readonly image: TImage; readonly sourceSize: ImageSize } | null
  readonly fileName: string
  readonly view: ViewId
}

export type VariableWorkspaceAssignment<TImage> = {
  readonly photos: readonly WorkspacePhoto<TImage>[]
  readonly spares: readonly WorkspaceSourcePhoto<TImage>[]
}

// 배정은 2층 구조다(2026-09-01 재설계 — "정면이 측면으로 승격" 실측 재현 후):
//  1층 상대 서열: 실사진에서는 pitch·yaw 추정의 절대값이 기대표와 크게 어긋나
//     절대 거리 방식은 뷰끼리 자리를 훔친다. 같은 층 안의 순서는 상대 비교로만 정한다.
//  2층 절대 거부권(view-plausibility): 상대 서열은 세트에 없는 각도도 최상위 사진에
//     라벨을 붙여버리므로, "그 뷰일 수 있는 최소 조건"을 통과한 후보만 서열에 올린다.
//     조건 미달 사진은 정면대 풀 또는 예비(spares)로 남는다. 좌우 부호 의미
//     (양수 yaw = 코가 화면 오른쪽 = 우측면)는 불변.
// 같은 세트 안 정면 사진끼리 스마일 점수가 이만큼 벌어질 때만 한 장을 '정면 스마일'로 본다.
// 절대 문턱을 두지 않는 이유: 입 크기·치아 노출은 사람마다 달라 한 장만 보고 판정할 수 없다.
export const SMILE_SPLIT_MIN_GAP = 0.06

export function organizeVariableWorkspacePhotos<TImage>(
  sources: readonly WorkspaceSourcePhoto<TImage>[],
  viewSet: ViewSet = VIEW_SETS.standardSeven,
): VariableWorkspaceAssignment<TImage> {
  const remainingSources = [...sources]
  const wants = (view: ViewId) => viewSetIncludes(viewSet, view)
  const organized: WorkspacePhoto<TImage>[] = []
  const pitchMedian = setPitchMedian(sources.map((source) => source.pose.pitchScore))

  const take = (index: number, view: ViewId) => {
    const source = remainingSources[index]
    if (source === undefined) {
      throw new Error("Variable assignment candidate is unavailable")
    }
    remainingSources.splice(index, 1)
    organized.push({
      ...source,
      adjustment: DEFAULT_CROP_ADJUSTMENT,
      assignmentMethod: "auto",
      view,
    })
  }

  // take()는 배열을 줄이므로, 인덱스가 큰 것부터 소비해 어긋남을 막는다.
  const takeAll = (picks: readonly { index: number; view: ViewId }[]) => {
    for (const pick of [...picks].toSorted((left, right) => right.index - left.index)) {
      take(pick.index, pick.view)
    }
  }

  // [측향 층] 한쪽 방향의 후보(거부권 통과)만 놓고 서열을 매긴다: 후보 2장 이상이면
  // 더 극단 = 측면, 다음 = 45도. 후보가 1장뿐이면 확신 대역(≥0.7) 미만은 측면 대신
  // 45도로 낮춰 부른다 — 측면↔45도가 절대값으로 안 갈리는 겹침 대역에서 정직한 쪽.
  // 2위는 1위와 다른 자세여야 한다: 같은 사진의 반복은 45도 자리를 채우지 못하고
  // 예비로 남는다(2026-09-02 실측: 측면 복제본이 45도로 승격).
  const takeLateralSide = (direction: 1 | -1, profileView: ViewId, obliqueView: ViewId) => {
    const candidates = remainingSources
      .map((source, index) => ({ index, source }))
      .filter(({ source }) => isLateralCandidate(source.pose, direction))
      .toSorted(
        (left, right) => (right.source.pose.yawScore - left.source.pose.yawScore) * direction,
      )
    const top = candidates[0]
    if (top === undefined) {
      return
    }
    const second = candidates
      .slice(1)
      .find(({ source }) => isDistinctLateralPose(top.source.pose, source.pose))
    if (second === undefined) {
      // 세트에 없는 뷰로는 보내지 않는다 — 측면만 있는 세트에서 측면 사진을 45도로 부르지 않는다.
      const view = isConfidentProfile(top.source.pose) ? profileView : obliqueView
      if (wants(view)) {
        take(top.index, view)
      }
      return
    }
    takeAll([
      ...(wants(profileView) ? [{ index: top.index, view: profileView }] : []),
      ...(wants(obliqueView) ? [{ index: second.index, view: obliqueView }] : []),
    ])
  }
  takeLateralSide(1, "rightProfile", "rightOblique")
  takeLateralSide(-1, "leftProfile", "leftOblique")

  // [정면대 층] 정면대(|yaw| < 측향 하한) 사진만 풀에 올린다. 정면은 안전한 기본
  // 라벨이라 세트 pitch 중앙값에 가장 가까운 사진이 무게이트로 받고, 턱밑·정수리는
  // 중앙값에서 방향까지 맞게 충분히(≥ TRIO_MIN_PITCH_DELTA) 벗어난 사진만 받는다.
  // 정면 복제 세트가 턱밑·정수리로 갈라지던 오염이 여기서 끊기고, 자격 없는
  // 정면대 사진은 예비로 남는다.
  const pool = remainingSources
    .map((source, index) => ({ index, source }))
    .filter(({ source }) => isFrontalBand(source.pose))

  // [스마일 분리] 세트에 '정면 스마일'이 있으면, 정면대 사진 중 스마일 점수가 뚜렷하게
  // 높은 한 장을 먼저 떼어 둔다(두 장 이상이고 점수 차가 충분할 때만 — 한 장만 있으면
  // 스마일을 지어내지 않는다).
  // 턱밑·정수리 자세는 입 모양이 원근으로 달라지므로, 정면 허용 기울기 안의 사진만 비교한다.
  const scoredPool = pool.filter(
    (entry) =>
      entry.source.pose.smileScore !== undefined &&
      Math.abs(entry.source.pose.pitchScore - pitchMedian) < FRONT_MAX_PITCH_DELTA,
  )
  const smilePick =
    wants("frontSmile") && scoredPool.length >= 2
      ? (() => {
          const sorted = scoredPool.toSorted(
            (left, right) =>
              (right.source.pose.smileScore ?? 0) - (left.source.pose.smileScore ?? 0),
          )
          const top = sorted[0]
          const bottom = sorted.at(-1)
          return top !== undefined &&
            bottom !== undefined &&
            (top.source.pose.smileScore ?? 0) - (bottom.source.pose.smileScore ?? 0) >=
              SMILE_SPLIT_MIN_GAP
            ? top
            : undefined
        })()
      : undefined
  const frontPool = pool.filter((entry) => entry !== smilePick)

  const front = frontPool.toSorted(
    (left, right) =>
      Math.abs(left.source.pose.pitchScore - pitchMedian) -
      Math.abs(right.source.pose.pitchScore - pitchMedian),
  )[0]
  const picks: { index: number; view: ViewId }[] = []
  if (smilePick !== undefined) {
    picks.push({ index: smilePick.index, view: "frontSmile" })
  }
  if (front !== undefined && wants("front")) {
    picks.push({ index: front.index, view: "front" })
    const rest = frontPool
      .filter((entry) => entry !== front)
      .toSorted((left, right) => left.source.pose.pitchScore - right.source.pose.pitchScore)
    const lowest = rest[0]
    const chinPick =
      wants("chinUp") &&
      lowest !== undefined &&
      chinUpQualifies(lowest.source.pose.pitchScore, pitchMedian)
        ? lowest
        : undefined
    if (chinPick !== undefined) {
      picks.push({ index: chinPick.index, view: "chinUp" })
    }
    const highest = rest.at(-1)
    // 같은 사진을 두 뷰로 쓸 수는 없다 — 한 장뿐인 rest가 턱밑으로 갔으면 정수리는 비운다.
    const crownCandidate = highest === chinPick ? undefined : highest
    if (
      wants("crownDown") &&
      crownCandidate !== undefined &&
      crownDownQualifies(crownCandidate.source.pose.pitchScore, pitchMedian)
    ) {
      picks.push({ index: crownCandidate.index, view: "crownDown" })
    }
  }
  takeAll(picks)

  return {
    photos: viewSet.views.flatMap((view) => organized.filter((photo) => photo.view === view)),
    spares: remainingSources,
  }
}

export function organizePartialWorkspacePhotos<TImage>(
  sources: readonly WorkspaceSourcePhoto<TImage>[],
): readonly WorkspacePhoto<TImage>[] {
  return organizeVariableWorkspacePhotos(sources).photos
}

export function missingWorkspaceViews<TImage>(
  photos: readonly WorkspacePhoto<TImage>[],
  viewSet: ViewSet = VIEW_SETS.standardSeven,
): readonly ViewId[] {
  return viewSet.views.filter((view) => photos.every((photo) => photo.view !== view))
}

type ManualWorkspacePhotoInput<TImage> = {
  readonly id: PhotoId
  readonly image: TImage
  readonly sourceSize: ImageSize
  readonly view: ViewId
}

export function createManualWorkspacePhoto<TImage>(
  input: ManualWorkspacePhotoInput<TImage>,
): WorkspacePhoto<TImage> {
  return {
    adjustment: DEFAULT_CROP_ADJUSTMENT,
    assignmentMethod: "manual",
    image: input.image,
    pose: {
      anchor: { x: 0.5, y: 0.5 },
      bounds: { left: 0.2, top: 0.15, right: 0.8, bottom: 0.85 },
      confidence: 0,
      id: input.id,
      pitchScore: 0.5,
      rollDegrees: 0,
      yawScore: 0,
    },
    sourceSize: input.sourceSize,
    view: input.view,
  }
}
