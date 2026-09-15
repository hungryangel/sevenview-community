import { describe, expect, it } from "vitest"

import {
  detectSessionMixup,
  SEQUENCE_NUMBER_GAP,
  SESSION_GAP_MINUTES,
  type SessionPhotoMeta,
} from "../src/domain/session-mixup"

function meta(overrides: Partial<SessionPhotoMeta> & { readonly key: string }): SessionPhotoMeta {
  return {
    camera: null,
    captureTime: null,
    fileName: `${overrides.key}.jpg`,
    ...overrides,
  }
}

function minutes(base: Date, offset: number): Date {
  return new Date(base.getTime() + offset * 60_000)
}

const BASE = new Date(2026, 8, 1, 10, 0, 0)

describe("detectSessionMixup — 촬영 시각 간격", () => {
  it("연속 촬영(임계 이내)은 침묵한다", () => {
    const metas = [0, 1, 2, 3, 4, 5, 6].map((index) =>
      meta({ key: `photo-${index + 1}`, captureTime: minutes(BASE, index) }),
    )
    expect(detectSessionMixup(metas)).toEqual([])
  })

  it("임계를 넘는 간격이 있으면 소수 쪽 사진을 지목한다", () => {
    const metas = [
      ...[0, 1, 2, 3, 4, 5].map((index) =>
        meta({ key: `photo-${index + 1}`, captureTime: minutes(BASE, index) }),
      ),
      meta({ key: "photo-7", captureTime: minutes(BASE, 5 + SESSION_GAP_MINUTES + 25) }),
    ]
    const signals = detectSessionMixup(metas)
    expect(signals).toHaveLength(1)
    expect(signals[0]).toMatchObject({ kind: "time_gap", offenders: ["photo-7"] })
  })

  it("촬영 시각이 전무하거나 1장뿐이면 판정하지 않는다", () => {
    const noTimes = [meta({ key: "photo-1" }), meta({ key: "photo-2" })]
    const oneTime = [meta({ key: "photo-1", captureTime: BASE }), meta({ key: "photo-2" })]
    expect(detectSessionMixup(noTimes)).toEqual([])
    expect(detectSessionMixup(oneTime)).toEqual([])
  })
})

describe("detectSessionMixup — 카메라 기종 불일치", () => {
  it("두 기종이 섞이면 소수 기종 사진을 지목한다", () => {
    const metas = [
      ...[1, 2, 3, 4, 5, 6].map((index) => meta({ key: `photo-${index}`, camera: "Canon EOS R6" })),
      meta({ key: "photo-7", camera: "Apple iPhone 15 Pro" }),
    ]
    const signals = detectSessionMixup(metas)
    expect(signals).toHaveLength(1)
    expect(signals[0]).toMatchObject({ kind: "camera_mismatch", offenders: ["photo-7"] })
  })

  it("기종 정보가 없으면 판정하지 않는다", () => {
    const metas = [meta({ key: "photo-1" }), meta({ key: "photo-2" })]
    expect(detectSessionMixup(metas)).toEqual([])
  })
})

describe("detectSessionMixup — 파일명 연번 불연속", () => {
  it("연번이 이어지면 침묵한다", () => {
    const metas = [1, 2, 3, 4, 5, 6, 7].map((index) =>
      meta({ key: `photo-${index}`, fileName: `IMG_000${index}.JPG` }),
    )
    expect(detectSessionMixup(metas)).toEqual([])
  })

  it("연번이 크게 건너뛰면 소수 쪽을 지목한다", () => {
    const metas = [
      ...[1, 2, 3, 4, 5, 6].map((index) =>
        meta({ key: `photo-${index}`, fileName: `IMG_000${index}.JPG` }),
      ),
      meta({
        key: "photo-7",
        fileName: `IMG_0${String(6 + SEQUENCE_NUMBER_GAP + 30)}.JPG`,
      }),
    ]
    const signals = detectSessionMixup(metas)
    expect(signals).toHaveLength(1)
    expect(signals[0]).toMatchObject({ kind: "sequence_gap", offenders: ["photo-7"] })
  })

  it("연번 패턴이 아니거나 접두사가 다르면 판정하지 않는다", () => {
    const notNumbered = [
      meta({ key: "photo-1", fileName: "front.jpg" }),
      meta({ key: "photo-2", fileName: "side.jpg" }),
    ]
    const mixedPrefixes = [
      meta({ key: "photo-1", fileName: "IMG_0001.JPG" }),
      meta({ key: "photo-2", fileName: "DSC_0900.JPG" }),
    ]
    expect(detectSessionMixup(notNumbered)).toEqual([])
    expect(detectSessionMixup(mixedPrefixes)).toEqual([])
  })
})
