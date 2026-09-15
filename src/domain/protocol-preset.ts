import { type Point, VIEW_IDS, type ViewId } from "./types"
import { VIEW_LABELS } from "./workspace"

export type SevenViewPreset = {
  readonly aspectRatio: "4:5"
  readonly draft: true
  readonly labels: Readonly<Record<ViewId, string>>
  readonly lateralityConvention: "patient"
  readonly name: "Standard 7 View (초안)"
  readonly viewOrder: readonly ViewId[]
}

export const STANDARD_SEVEN_VIEW_DRAFT = {
  aspectRatio: "4:5",
  draft: true,
  labels: VIEW_LABELS,
  lateralityConvention: "patient",
  name: "Standard 7 View (초안)",
  viewOrder: VIEW_IDS,
} as const satisfies SevenViewPreset

// 크롭 프레이밍 프리셋 — 뷰별로 "감지된 얼굴 크기를 프레임의 몇 %로, 얼굴 중점을
// 어디에 둘지"를 정한다. crop.ts는 이 수치만 읽는다.
// faceExtent: 배율 기준 축. 좌우로 돌아간 뷰(정면·45도·측면)는 정중선 위의
// 이마~턱 높이가 안정적이고, 위아래로 기울인 뷰(턱밑·정수리)는 이마~턱이 원근으로
// 줄어들므로 기울기에 불변인 얼굴 폭(양쪽 뺨)을 쓴다 — 그래야 7장의 배율이 맞는다.
// 커스텀 프리셋은 FRAMING_PRESETS에 항목을 추가하는 것으로 확장한다.
// 쇄골선 실측 정렬(어깨 랜드마크가 있을 때): 쇄골선을 프레임 세로 bottom에 놓고,
// 이마 랜드마크 위로 두피 높이(vertexAllowance × 얼굴높이)를 더한 정수리 추정점이
// topMargin 아래에 들어오도록 배율을 줄인다(얼굴 규칙 배율보다 커지진 않음).
// 원본에 그만한 여유가 없으면(커버 하한이 더 크면) 얼굴 비율 규칙으로 물러난다.
export type ClavicleFraming = {
  readonly bottom: number
  readonly topMargin: number
  readonly vertexAllowance: number
}

export type ViewFraming = {
  readonly faceExtent: "height" | "width"
  readonly faceRatio: number
  readonly targetAnchor: Point
  readonly clavicle?: ClavicleFraming | undefined
}

export type FramingPresetId = "clinicalStandard" | "closeUp"

export type FramingPreset = {
  readonly description: string
  readonly id: FramingPresetId
  readonly label: string
  // 도구막대 칩처럼 좁은 자리용 짧은 이름.
  readonly shortLabel: string
  readonly views: Readonly<Record<ViewId, ViewFraming>>
}

const FACE_VIEW_IDS = [
  "front",
  "frontSmile",
  "rightOblique",
  "leftOblique",
  "rightProfile",
  "leftProfile",
] as const

function faceViewFraming(
  framing: ViewFraming,
): Record<(typeof FACE_VIEW_IDS)[number], ViewFraming> {
  return Object.fromEntries(FACE_VIEW_IDS.map((view) => [view, framing])) as Record<
    (typeof FACE_VIEW_IDS)[number],
    ViewFraming
  >
}

// 임상 문서 표준(정면·45도·측면): 머리 꼭대기 위 배경 여백 ~10%, 아래는
// 쇄골/흉골절흔까지. 이마~턱=프레임 52%·중점 50%로 두면 두피(≈얼굴높이의
// 0.28배)를 더해 정수리가 ≈9% 지점, 턱 아래 쇄골(≈0.5배)이 하단에 온다.
// 턱밑·정수리에는 쇄골 규약이 없다 — 정면과 같은 배율(얼굴 폭 ≈ 이마~턱의 0.75배
// → 프레임 폭의 48%)로 얼굴을 중심에 두고, 턱밑은 목 쪽·정수리는 머리 쪽 여백을 준다.
// 원본에 그만한 여유가 없으면 커버 하한이 자동으로 더 타이트하게 자른다.
export const FRAMING_PRESETS: Readonly<Record<FramingPresetId, FramingPreset>> = {
  clinicalStandard: {
    description:
      "정면·45도·측면은 정수리 위 여백 ~10%에서 쇄골 높이까지, 턱밑·정수리는 같은 배율로 얼굴을 중심에 담습니다.",
    id: "clinicalStandard",
    label: "임상 표준 (정수리~쇄골)",
    shortLabel: "임상 표준",
    views: {
      ...faceViewFraming({
        faceExtent: "height",
        faceRatio: 0.52,
        targetAnchor: { x: 0.5, y: 0.5 },
        clavicle: { bottom: 0.96, topMargin: 0.1, vertexAllowance: 0.28 },
      }),
      // 턱밑: 고개를 젖히면 턱→쇄골 거리가 화면에서 길어진다. 쇄골까지 담으라는
      // 소유자 결정(2026-09-02)에 따라 정면보다 조금 작은 배율(폭 40%)로 얼굴을
      // 위쪽(중점 37%)에 두어 목·쇄골이 아래에 들어오게 한다(샘플 실측으로 조정).
      // 어깨가 실측되면 쇄골선을 하단(96%)에 정확히 놓는다. 젖힌 머리는 두피가 뒤로
      // 물러나 이마 위 여유를 작게(0.12) 잡는다. 정수리 뷰는 쇄골이 턱에 가려 규약 없음.
      chinUp: {
        faceExtent: "width",
        faceRatio: 0.4,
        targetAnchor: { x: 0.5, y: 0.37 },
        clavicle: { bottom: 0.96, topMargin: 0.08, vertexAllowance: 0.12 },
      },
      crownDown: { faceExtent: "width", faceRatio: 0.48, targetAnchor: { x: 0.5, y: 0.56 } },
    },
  },
  closeUp: {
    description: "얼굴 위주 확대 — 발표 슬라이드처럼 얼굴만 크게 볼 때 씁니다.",
    id: "closeUp",
    label: "클로즈업 (얼굴 확대)",
    shortLabel: "클로즈업",
    views: {
      ...faceViewFraming({
        faceExtent: "height",
        faceRatio: 0.76,
        targetAnchor: { x: 0.5, y: 0.48 },
      }),
      chinUp: { faceExtent: "height", faceRatio: 0.72, targetAnchor: { x: 0.5, y: 0.44 } },
      crownDown: { faceExtent: "height", faceRatio: 0.72, targetAnchor: { x: 0.5, y: 0.54 } },
    },
  },
}

export const DEFAULT_FRAMING_PRESET_ID: FramingPresetId = "clinicalStandard"

export const FRAMING_PRESET_IDS = Object.keys(FRAMING_PRESETS) as readonly FramingPresetId[]

export function isFramingPresetId(value: string): value is FramingPresetId {
  return value in FRAMING_PRESETS
}
