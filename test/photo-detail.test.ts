import { describe, expect, it } from "vitest"

import { photoId } from "../src/domain/types"
import type { WorkspacePhoto } from "../src/domain/workspace"
import { describePhotoDetail } from "../src/product/photo-detail"

const photo: WorkspacePhoto<string> = {
  adjustment: { panX: 0.03, panY: -0.02, rotationDegrees: 0.5, scaleMultiplier: 1.05 },
  assignmentMethod: "auto",
  image: "img",
  pose: {
    id: photoId("p1"),
    yawScore: 0.02,
    pitchScore: 0.37,
    rollDegrees: -0.3,
    confidence: 0.9,
    bounds: { left: 0.35, top: 0.4, right: 0.65, bottom: 0.6 },
    anchor: { x: 0.5, y: 0.5 },
    eyeCenter: { x: 0.5, y: 0.45 },
  },
  sourceSize: { width: 3024, height: 4032 },
  view: "front",
}

describe("describePhotoDetail", () => {
  it("lists source, camera, capture time, and manual crop values — never the file name", () => {
    const rows = describePhotoDetail(photo, {
      camera: "Apple iPhone 16 Pro",
      captureTime: new Date(2026, 7, 30, 13, 49),
      fileName: "김철수_36.jpg",
      key: "p1",
    })
    const rowValue = (label: string) => rows.find((row) => row.label === label)?.value

    expect(rowValue("원본")).toBe("3024 × 4032 px")
    expect(rowValue("카메라")).toBe("Apple iPhone 16 Pro")
    expect(rowValue("촬영 시각")).toContain("13:49")
    expect(rowValue("수동 보정")).toBe("배율 ×1.05 · 이동 +3% / −2% · 회전 +0.5°")
    expect(JSON.stringify(rows)).not.toContain("김철수")
  })

  it("stays honest when EXIF is missing and the photo was placed without landmarks", () => {
    const { eyeCenter: _dropped, ...landmarkless } = photo.pose
    const rows = describePhotoDetail(
      {
        ...photo,
        adjustment: { panX: 0, panY: 0, rotationDegrees: 0, scaleMultiplier: 1 },
        pose: landmarkless,
      },
      undefined,
    )
    const rowValue = (label: string) => rows.find((row) => row.label === label)?.value
    expect(rowValue("카메라")).toBe("정보 없음")
    expect(rowValue("촬영 시각")).toBe("정보 없음")
    expect(rowValue("수동 보정")).toBe("없음")
  })
})
