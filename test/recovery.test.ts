import { describe, expect, it } from "vitest"
import {
  createManualWorkspacePhoto,
  missingWorkspaceViews,
  organizePartialWorkspacePhotos,
  organizeVariableWorkspacePhotos,
  type WorkspaceSourcePhoto,
} from "../src/domain/recovery"
import { photoId } from "../src/domain/types"
import { VIEW_SETS } from "../src/domain/view-set"

const src = (id: string, yawScore: number, pitchScore: number): WorkspaceSourcePhoto<string> => ({
  image: id,
  pose: {
    id: photoId(id),
    yawScore,
    pitchScore,
    rollDegrees: 0,
    confidence: 0.9,
    bounds: { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 },
    anchor: { x: 0.5, y: 0.5 },
  },
  sourceSize: { width: 800, height: 1000 },
})

// 2026-09-01 합성 7종 실측값(브라우저에서 분석기 직접 실행): 대역 근거는
// src/domain/view-plausibility.ts 주석 참조.
const measuredSeven = [
  src("front", 0, 0.38),
  src("right-oblique", 0.436, 0.36),
  src("left-oblique", -0.436, 0.367),
  src("right-profile", 1.027, 0.358),
  src("left-profile", -0.952, 0.373),
  src("chin", 0, 0.047),
  src("crown", 0.02, 0.648),
]

const viewOf = (
  photos: readonly { readonly pose: { readonly id: string }; readonly view: string }[],
  id: string,
) => photos.find((photo) => photo.pose.id === id)?.view

describe("organizeVariableWorkspacePhotos — 정상 세트", () => {
  it("assigns the measured seven-view set exactly, with no spares", () => {
    const { photos, spares } = organizeVariableWorkspacePhotos(measuredSeven)

    expect(viewOf(photos, "front")).toBe("front")
    expect(viewOf(photos, "right-oblique")).toBe("rightOblique")
    expect(viewOf(photos, "left-oblique")).toBe("leftOblique")
    expect(viewOf(photos, "right-profile")).toBe("rightProfile")
    expect(viewOf(photos, "left-profile")).toBe("leftProfile")
    expect(viewOf(photos, "chin")).toBe("chinUp")
    expect(viewOf(photos, "crown")).toBe("crownDown")
    expect(spares).toHaveLength(0)
  })

  it("keeps six analyzed photos reviewable and reserves the missing slot for recovery", () => {
    // Given: a seven-photo intake where the crown image failed analysis.
    const six = measuredSeven.filter((source) => source.pose.id !== "crown")

    // When: the six successful sources receive provisional slots.
    const organized = organizePartialWorkspacePhotos(six)
    const missing = missingWorkspaceViews(organized)

    // Then: no good image is discarded and exactly the failed view remains recoverable.
    expect(organized).toHaveLength(6)
    expect(new Set(organized.map((photo) => photo.view)).size).toBe(6)
    expect(missing).toEqual(["crownDown"])
  })

  it("keeps a near-frontal duplicate out of the trio instead of stealing 정수리", () => {
    // Given: nine photos — a full set plus a duplicate oblique and a duplicate front.
    const nine = [...measuredSeven, src("dup-right", 0.43, 0.36), src("dup-front", 0.01, 0.39)]

    const { photos, spares } = organizeVariableWorkspacePhotos(nine)

    // Then: 중복 정면은 pitch 이탈이 없어 예비로 가고, 정수리는 그대로 남는다.
    expect(viewOf(photos, "crown")).toBe("crownDown")
    expect(viewOf(photos, "chin")).toBe("chinUp")
    expect(photos).toHaveLength(7)
    expect(new Set(spares.map((spare) => spare.pose.id))).toEqual(
      new Set(["dup-right", "dup-front"]),
    )
  })
})

describe("organizeVariableWorkspacePhotos — 각도 거부권", () => {
  it("keeps the patient-basis laterality rule for a confident profile pair", () => {
    // Given: 확신 대역(|yaw| ≥ 0.7)의 좌우 측면 한 쌍.
    const pair = [src("right", 0.95, 0.36), src("left", -0.95, 0.37)]

    const { photos } = organizeVariableWorkspacePhotos(pair)

    // Then: 양수 yaw(코가 화면 오른쪽) = 우측면, 음수 = 좌측면.
    expect(viewOf(photos, "right")).toBe("rightProfile")
    expect(viewOf(photos, "left")).toBe("leftProfile")
  })

  it("downgrades a lone sub-confident lateral to 45도 instead of calling it 측면", () => {
    // Given: 한쪽 방향 사진이 한 장뿐이고 확신 대역(0.7) 미만이다.
    const pair = [src("right", 0.36, 0.36), src("left", -0.36, 0.37)]

    const { photos } = organizeVariableWorkspacePhotos(pair)

    expect(viewOf(photos, "right")).toBe("rightOblique")
    expect(viewOf(photos, "left")).toBe("leftOblique")
    expect(photos.some((photo) => photo.view === "rightProfile")).toBe(false)
    expect(photos.some((photo) => photo.view === "leftProfile")).toBe(false)
  })

  it("never promotes frontal photos into lateral or pitch views (사용자 실측 재현)", () => {
    // Given: 정면 사진 3장뿐인 세트에서 정면이
    // "우측 측면 · 자동"으로 승격되던 입력 클래스.
    const fronts = [src("front-a", 0, 0.38), src("front-b", 0.02, 0.39), src("front-c", -0.01, 0.4)]

    const { photos, spares } = organizeVariableWorkspacePhotos(fronts)

    // Then: 정면 한 장만 배치되고 나머지는 예비로 — 어떤 측면·45도·턱밑·정수리
    // 라벨도 만들어내지 않는다.
    expect(photos).toHaveLength(1)
    expect(photos[0]?.view).toBe("front")
    expect(spares).toHaveLength(2)
  })

  it("leaves a side empty when every photo faces the other way", () => {
    // Given: 전부 왼쪽을 향한 사진들(우측 후보 0).
    const lefts = [src("left-profile", -0.95, 0.37), src("left-oblique", -0.44, 0.36)]

    const { photos } = organizeVariableWorkspacePhotos(lefts)

    expect(viewOf(photos, "left-profile")).toBe("leftProfile")
    expect(viewOf(photos, "left-oblique")).toBe("leftOblique")
    expect(photos.some((photo) => photo.view === "rightProfile")).toBe(false)
    expect(photos.some((photo) => photo.view === "rightOblique")).toBe(false)
  })

  it("rejects a too-shallow pitch for 턱밑·정수리 instead of inventing the view", () => {
    // Given: 정면대 3장 — 중앙값 대비 이탈이 거부권 하한(0.12) 미만인 위아래 후보.
    const shallow = [src("front", 0, 0.5), src("chin-ish", 0.01, 0.42), src("crown-ish", 0, 0.58)]

    const { photos, spares } = organizeVariableWorkspacePhotos(shallow)

    expect(photos).toHaveLength(1)
    expect(photos[0]?.view).toBe("front")
    expect(spares).toHaveLength(2)
  })
})

describe("organizeVariableWorkspacePhotos — 같은 사진 반복", () => {
  // 같은 사진을 여러 장 넣어도 측면 복제본이 '우측 45도 · 자동'으로
  // 앉았다(기준점 흐림 경고만). 2위 후보는 1위와 다른 자세여야 45도가 된다.
  const duplicateProfile = src("right-profile-dup", 1.027, 0.358)

  it("keeps a duplicated profile out of 45도 — the slot stays honest (미촬영)", () => {
    const sources = [
      ...measuredSeven.filter((source) => source.pose.id !== "right-oblique"),
      duplicateProfile,
    ]
    const { photos, spares } = organizeVariableWorkspacePhotos(sources)

    expect(viewOf(photos, "right-profile") ?? viewOf(photos, "right-profile-dup")).toBe(
      "rightProfile",
    )
    expect(photos.some((photo) => photo.view === "rightOblique")).toBe(false)
    expect(spares).toHaveLength(1)
  })

  it("still finds the real 45도 behind a duplicated profile", () => {
    const { photos, spares } = organizeVariableWorkspacePhotos([...measuredSeven, duplicateProfile])

    expect(viewOf(photos, "right-oblique")).toBe("rightOblique")
    expect(spares.map((spare) => spare.pose.id)).toEqual(["right-profile-dup"])
  })

  it("does not fabricate 측면 from two identical 45도 copies", () => {
    const sources = [
      ...measuredSeven.filter((source) => source.pose.id !== "right-profile"),
      src("right-oblique-dup", 0.436, 0.36),
    ]
    const { photos, spares } = organizeVariableWorkspacePhotos(sources)

    expect(photos.some((photo) => photo.view === "rightProfile")).toBe(false)
    expect(photos.filter((photo) => photo.view === "rightOblique")).toHaveLength(1)
    expect(spares).toHaveLength(1)
  })
})

describe("organizeVariableWorkspacePhotos — 실측 노이즈 내성", () => {
  it("keeps the trio correct when duplicates and noisy near-frontal yaw compete", () => {
    // Given: 2026-09-01 실사진 프로브에서 관측된 수준의 값들 — 턱밑·정수리의 yaw가
    // 0이 아니고, 중복 45도 컷이 섞여 있다.
    const nine = [
      src("front", -0.05, 0.47),
      src("right-oblique", 0.28, 0.5),
      src("left-oblique", -0.28, 0.5),
      src("right-profile", 0.33, 0.52),
      src("left-profile", -0.33, 0.48),
      src("chin", -0.03, 0.36),
      src("crown", 0.15, 0.65),
      src("dup-right", 0.27, 0.5),
      src("dup-left", -0.27, 0.5),
    ]

    const { photos, spares } = organizeVariableWorkspacePhotos(nine)

    expect(viewOf(photos, "front")).toBe("front")
    expect(viewOf(photos, "chin")).toBe("chinUp")
    expect(viewOf(photos, "crown")).toBe("crownDown")
    expect(viewOf(photos, "right-profile")).toBe("rightProfile")
    expect(viewOf(photos, "left-profile")).toBe("leftProfile")
    expect(viewOf(photos, "right-oblique")).toBe("rightOblique")
    expect(viewOf(photos, "left-oblique")).toBe("leftOblique")
    expect(new Set(spares.map((spare) => spare.pose.id))).toEqual(
      new Set(["dup-right", "dup-left"]),
    )
  })
})

describe("manual view recovery", () => {
  it("turns a decoded face-detection failure into a central manual crop without inventing confidence", () => {
    // Given: a decodable image where landmarks were not detected.

    // When: the user assigns it manually to the missing view.
    const manual = createManualWorkspacePhoto({
      id: photoId("failed-photo"),
      image: "recoverable-preview",
      sourceSize: { width: 600, height: 800 },
      view: "chinUp",
    })

    // Then: it has a neutral central crop and is visibly manual rather than automatically confident.
    expect(manual).toMatchObject({
      adjustment: { panX: 0, panY: 0, rotationDegrees: 0, scaleMultiplier: 1 },
      assignmentMethod: "manual",
      pose: { anchor: { x: 0.5, y: 0.5 }, confidence: 0 },
      view: "chinUp",
    })
  })
})

describe("organizeVariableWorkspacePhotos — 뷰 세트(2026-09-03)", () => {
  const withSmile = (source: WorkspaceSourcePhoto<string>, smileScore: number) => ({
    ...source,
    pose: { ...source.pose, smileScore },
  })

  it("fills the dental six from a seven-view intake: 턱밑·정수리 become spares, 정면 스마일 is not invented", () => {
    const { photos, spares } = organizeVariableWorkspacePhotos(measuredSeven, VIEW_SETS.dentalSix)

    expect(photos.map((photo) => photo.view)).toEqual([
      "front",
      "rightOblique",
      "leftOblique",
      "rightProfile",
      "leftProfile",
    ])
    expect(spares.map((spare) => spare.pose.id).toSorted()).toEqual(["chin", "crown"])
  })

  it("splits a clearly smiling frontal into 정면 스마일 only when the set has that view", () => {
    const sources = [
      ...measuredSeven.map((source) =>
        source.pose.id === "front" ? withSmile(source, 0.34) : source,
      ),
      withSmile(src("front-smile", 0.01, 0.39), 0.5),
    ]

    const dental = organizeVariableWorkspacePhotos(sources, VIEW_SETS.dentalSix)
    expect(viewOf(dental.photos, "front")).toBe("front")
    expect(viewOf(dental.photos, "front-smile")).toBe("frontSmile")

    // 성형외과 7뷰에는 스마일 슬롯이 없으니 두 번째 정면은 예비로 남는다.
    const standard = organizeVariableWorkspacePhotos(sources)
    expect(viewOf(standard.photos, "front")).toBe("front")
    expect(standard.spares.map((spare) => spare.pose.id)).toEqual(["front-smile"])
  })

  it("does not split when the smile scores are within noise of each other", () => {
    const sources = [
      ...measuredSeven.map((source) =>
        source.pose.id === "front" ? withSmile(source, 0.36) : source,
      ),
      withSmile(src("front-2", 0.01, 0.375), 0.39),
    ]
    const { photos, spares } = organizeVariableWorkspacePhotos(sources, VIEW_SETS.dentalSix)
    expect(photos.some((photo) => photo.view === "frontSmile")).toBe(false)
    expect(spares).toHaveLength(3) // chin, crown, front-2
  })
})
