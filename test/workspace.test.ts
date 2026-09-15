import { describe, expect, it } from "vitest"
import { photoId, type SevenViewAssignment } from "../src/domain/types"
import {
  assignWorkspacePhotoToView,
  findLateralityConflicts,
  organizeWorkspacePhotos,
  reorderViewSequence,
  reorderWorkspacePhotos,
  resetWorkspaceAdjustments,
  swapLateralityPair,
  VIEW_LABELS,
  type WorkspaceSourcePhoto,
} from "../src/domain/workspace"

const sourcePhotos: readonly WorkspaceSourcePhoto<string>[] = Array.from(
  { length: 7 },
  (_, index) => ({
    image: `image-${index + 1}`,
    pose: {
      id: photoId(`photo-${index + 1}`),
      yawScore: 0,
      pitchScore: 0,
      rollDegrees: 0,
      confidence: 0.9,
      bounds: { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 },
      anchor: { x: 0.5, y: 0.5 },
    },
    sourceSize: { width: 800, height: 1000 },
  }),
)

const assignment: SevenViewAssignment = {
  front: photoId("photo-4"),
  rightOblique: photoId("photo-6"),
  leftOblique: photoId("photo-2"),
  rightProfile: photoId("photo-7"),
  leftProfile: photoId("photo-1"),
  chinUp: photoId("photo-5"),
  crownDown: photoId("photo-3"),
}

describe("organizeWorkspacePhotos", () => {
  it("maps analyzed sources into the canonical seven-view order", () => {
    const photos = organizeWorkspacePhotos(sourcePhotos, assignment)

    expect(photos.map((photo) => [photo.view, photo.pose.id])).toEqual([
      ["front", "photo-4"],
      ["rightOblique", "photo-6"],
      ["leftOblique", "photo-2"],
      ["rightProfile", "photo-7"],
      ["leftProfile", "photo-1"],
      ["chinUp", "photo-5"],
      ["crownDown", "photo-3"],
    ])
    expect(photos.every((photo) => photo.adjustment.scaleMultiplier === 1)).toBe(true)
  })
})

describe("SevenView draft protocol", () => {
  it("uses the approved Korean labels while keeping the canonical ids", () => {
    // Given: the immutable seven-view identifiers.

    // When: the Community display protocol is read.

    // Then: it exposes the approved draft labels without embedding laterality in every label.
    expect(VIEW_LABELS).toEqual({
      front: "정면",
      frontSmile: "정면 스마일",
      rightOblique: "우측 45도",
      leftOblique: "좌측 45도",
      rightProfile: "우측 측면",
      leftProfile: "좌측 측면",
      chinUp: "아래 (턱 밑)",
      crownDown: "위 (정수리)",
    })
  })
})

describe("manual view recovery", () => {
  it("swaps a selected photo into a manually assigned target slot", () => {
    // Given: an automatically organized seven-view set.
    const photos = organizeWorkspacePhotos(sourcePhotos, assignment)

    // When: the front photo is manually assigned to the left-profile slot.
    const reassigned = assignWorkspacePhotoToView(photos, "front", "leftProfile")

    // Then: the selected source moves, the displaced source swaps back, and only the chosen slot is manual.
    expect(reassigned.find((photo) => photo.view === "front")).toMatchObject({
      pose: { id: "photo-1" },
      assignmentMethod: "auto",
    })
    expect(reassigned.find((photo) => photo.view === "leftProfile")).toMatchObject({
      pose: { id: "photo-4" },
      assignmentMethod: "manual",
    })
  })

  it("moves a photo into an empty view instead of throwing (2026-09-02 버튼 무동작 수정)", () => {
    // Given: a set whose left-profile slot is empty (미촬영).
    const photos = organizeWorkspacePhotos(sourcePhotos, assignment).filter(
      (photo) => photo.view !== "leftProfile",
    )

    // When: the front photo is manually sent to the empty slot.
    const reassigned = assignWorkspacePhotoToView(photos, "front", "leftProfile")

    // Then: the photo moves (manual), the source slot becomes empty, nothing is lost.
    // (이 픽스처에서 front 슬롯은 photo-4가 차지한다.)
    expect(reassigned).toHaveLength(photos.length)
    expect(reassigned.find((photo) => photo.view === "front")).toBeUndefined()
    expect(reassigned.find((photo) => photo.view === "leftProfile")).toMatchObject({
      pose: { id: "photo-4" },
      assignmentMethod: "manual",
    })
  })

  it("flags a synthetic left-right reversal and repairs the pair with one swap", () => {
    // Given: two lateral pairs whose yaw signs contradict their assigned patient-side labels.
    const photos = organizeWorkspacePhotos(sourcePhotos, assignment).map((photo) => {
      if (photo.view === "rightOblique" || photo.view === "rightProfile") {
        return { ...photo, pose: { ...photo.pose, yawScore: -0.25 } }
      }
      if (photo.view === "leftOblique" || photo.view === "leftProfile") {
        return { ...photo, pose: { ...photo.pose, yawScore: 0.25 } }
      }
      return photo
    })

    // When: conflicting labels are detected and the oblique pair is swapped.
    const conflicts = findLateralityConflicts(photos)
    const repaired = swapLateralityPair(photos, "rightOblique")

    // Then: both conflicting pairs are explicit and the repaired oblique pair no longer contradicts yaw.
    expect(conflicts.map((conflict) => conflict.view)).toEqual([
      "rightOblique",
      "leftOblique",
      "rightProfile",
      "leftProfile",
    ])
    expect(findLateralityConflicts(repaired).map((conflict) => conflict.view)).toEqual([
      "rightProfile",
      "leftProfile",
    ])
  })
})

describe("reorderWorkspacePhotos", () => {
  it("moves the source while preserving canonical slot identities", () => {
    const photos = organizeWorkspacePhotos(sourcePhotos, assignment)
    const reordered = reorderWorkspacePhotos(photos, 0, 1)

    expect(reordered[0]?.view).toBe("front")
    expect(reordered[0]?.pose.id).toBe("photo-6")
    expect(reordered[1]?.view).toBe("rightOblique")
    expect(reordered[1]?.pose.id).toBe("photo-4")
    expect(photos[0]?.pose.id).toBe("photo-4")
  })

  it("returns the same ordering when a move would leave the seven slots", () => {
    const photos = organizeWorkspacePhotos(sourcePhotos, assignment)

    expect(reorderWorkspacePhotos(photos, 0, -1)).toEqual(photos)
    expect(reorderWorkspacePhotos(photos, 6, 1)).toEqual(photos)
  })
})

describe("review ordering and reset", () => {
  it("reorders rail positions without changing the canonical view assignment", () => {
    // Given: a canonical view sequence and a ready workspace.
    const photos = organizeWorkspacePhotos(sourcePhotos, assignment)

    // When: the selected rail item moves one position later.
    const sequence = reorderViewSequence(
      [
        "front",
        "rightOblique",
        "leftOblique",
        "rightProfile",
        "leftProfile",
        "chinUp",
        "crownDown",
      ],
      "front",
      "rightOblique",
    )

    // Then: rail order changes while photo-to-view assignments do not.
    expect(sequence.slice(0, 2)).toEqual(["rightOblique", "front"])
    expect(photos.find((photo) => photo.view === "front")?.pose.id).toBe("photo-4")
  })

  it("restores every crop adjustment without changing a manual assignment", () => {
    // Given: a manually assigned photo with a non-default crop.
    const manuallyAssigned = assignWorkspacePhotoToView(
      organizeWorkspacePhotos(sourcePhotos, assignment),
      "front",
      "leftProfile",
    ).map((photo) =>
      photo.view === "leftProfile"
        ? {
            ...photo,
            adjustment: { panX: 0.15, panY: -0.1, rotationDegrees: 4.5, scaleMultiplier: 1.1 },
          }
        : photo,
    )

    // When: a reviewer resets every adjustment.
    const reset = resetWorkspaceAdjustments(manuallyAssigned)

    // Then: the manual source remains manual while all adjustment values return to defaults.
    expect(reset.find((photo) => photo.view === "leftProfile")).toMatchObject({
      assignmentMethod: "manual",
      adjustment: { panX: 0, panY: 0, rotationDegrees: 0, scaleMultiplier: 1 },
    })
  })
})
