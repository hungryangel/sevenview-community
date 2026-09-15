import { describe, expect, it } from "vitest"

import { angleBetweenPoints, rotationToLevel } from "../src/product/level-by-points"

describe("level by two points", () => {
  it("measures the tilt of the picked line in degrees", () => {
    expect(angleBetweenPoints({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(0)
    expect(angleBetweenPoints({ x: 0, y: 0 }, { x: 100, y: 100 })).toBeCloseTo(45, 6)
    expect(angleBetweenPoints({ x: 100, y: 50 }, { x: 300, y: 40 })).toBeCloseTo(-2.862, 3)
  })

  it("rotates the crop so the picked line becomes horizontal, within the ±12° control range", () => {
    // 오른쪽이 10px 내려간 선(+2.9°) → 현재 회전 0에서 -2.9°로.
    expect(rotationToLevel(0, { x: 50, y: 200 }, { x: 250, y: 210 })).toEqual({
      clipped: false,
      rotationDegrees: -2.9,
    })
    // 이미 1.5° 돌려둔 상태에서 같은 선을 찍으면 그만큼 더 뺀다.
    expect(rotationToLevel(1.5, { x: 50, y: 200 }, { x: 250, y: 210 }).rotationDegrees).toBe(-1.4)
    // 45° 기울기는 범위를 넘으므로 잘라내고 알려준다.
    expect(rotationToLevel(0, { x: 0, y: 0 }, { x: 100, y: 100 })).toEqual({
      clipped: true,
      rotationDegrees: -12,
    })
  })
})
