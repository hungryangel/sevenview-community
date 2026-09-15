import type { ViewId } from "./types"

// 뷰 세트(2026-09-03 bee 결정): 어떤 뷰를 몇 개, 어떤 순서로 쓰는지를 데이터로 정한다.
// 판정·레일·시트 배치·내보내기는 전부 이 세트를 읽는다. 병원별 커스텀은 항목 추가로 확장.
export type ViewSetId = "standardSeven" | "dentalSix"

export type ViewSet = {
  readonly description: string
  readonly id: ViewSetId
  readonly label: string
  // 도구막대 칩처럼 좁은 자리용 짧은 이름.
  readonly shortLabel: string
  // 컨택트 시트 줄별 칸 수(합 = views.length).
  readonly sheetRows: readonly number[]
  readonly views: readonly ViewId[]
}

export const VIEW_SETS: Readonly<Record<ViewSetId, ViewSet>> = {
  standardSeven: {
    description: "정면·좌우 45도·좌우 측면·턱밑·정수리. 성형외과 컨퍼런스용 초안 프로토콜.",
    id: "standardSeven",
    label: "성형외과 표준 7뷰 (초안)",
    sheetRows: [4, 3],
    shortLabel: "표준 7뷰",
    views: [
      "front",
      "rightOblique",
      "leftOblique",
      "rightProfile",
      "leftProfile",
      "chinUp",
      "crownDown",
    ],
  },
  // 교정·구강외과 안면 사진의 흔한 구성(⚠️원장님 확인 전 초안): 정면 무표정·스마일,
  // 좌우 45도·측면. 턱밑·정수리 사진은 버리지 않고 예비로 둔다.
  dentalSix: {
    description:
      "정면 무표정·정면 스마일·좌우 45도·좌우 측면. 턱밑·정수리는 예비로 둡니다. 구성은 원장님 확인 후 조정합니다.",
    id: "dentalSix",
    label: "치과·구강외과 6뷰 (초안)",
    sheetRows: [3, 3],
    shortLabel: "치과 6뷰",
    views: ["front", "frontSmile", "rightOblique", "leftOblique", "rightProfile", "leftProfile"],
  },
}

export const DEFAULT_VIEW_SET_ID: ViewSetId = "standardSeven"

export const VIEW_SET_IDS = Object.keys(VIEW_SETS) as readonly ViewSetId[]

export function isViewSetId(value: string): value is ViewSetId {
  return value in VIEW_SETS
}

export function viewSetIncludes(viewSet: ViewSet, view: ViewId): boolean {
  return viewSet.views.includes(view)
}

// 시트 줄 구성대로 뷰를 나눈다(설정 카드의 슬롯 도식·시트 배치가 같은 줄 나눔을 쓴다).
export function viewSetRows(viewSet: ViewSet): readonly (readonly ViewId[])[] {
  const rows: ViewId[][] = []
  let offset = 0
  for (const count of viewSet.sheetRows) {
    rows.push([...viewSet.views.slice(offset, offset + count)])
    offset += count
  }
  if (offset < viewSet.views.length) {
    rows.push([...viewSet.views.slice(offset)])
  }
  return rows
}
