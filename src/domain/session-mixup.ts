import type { ExifSummary } from "./exif-capture-time"

// 한 환자의 7뷰는 통상 한 자리에서 수 분 안에 연속 촬영된다는 통념에 기댄 가설값이다.
// 임상 실측값이 아니며 파트너 테스트 후 조정한다. 임계 이내 간격으로 연속 촬영된
// "다른 환자"는 이 신호로 원리적으로 잡지 못한다 — 최종 확인은 사람 책임이다.
export const SESSION_GAP_MINUTES = 15

// DSLR 연번(IMG_0001 등)이 이 폭보다 크게 건너뛰면 카드에 남아 있던 예전 촬영의
// 파일이 섞였을 가능성이 있다. 파일명이 연번 패턴이 아닐 때는 판정하지 않는다.
export const SEQUENCE_NUMBER_GAP = 20

export type SessionPhotoMeta = {
  readonly camera: string | null
  readonly captureTime: Date | null
  readonly fileName: string
  readonly key: string
}

export type SessionMixupSignal =
  | {
      readonly kind: "time_gap"
      readonly maxGapMinutes: number
      readonly offenders: readonly string[]
    }
  | {
      readonly kind: "camera_mismatch"
      readonly cameras: readonly string[]
      readonly offenders: readonly string[]
    }
  | { readonly kind: "sequence_gap"; readonly offenders: readonly string[] }

export function cameraLabel(summary: ExifSummary): string | null {
  const parts = [summary.cameraMake, summary.cameraModel].filter(
    (part): part is string => part !== null,
  )
  return parts.length === 0 ? null : parts.join(" ")
}

function smallerSide<T>(before: readonly T[], after: readonly T[]): readonly T[] {
  return after.length <= before.length ? after : before
}

function detectTimeGap(metas: readonly SessionPhotoMeta[]): SessionMixupSignal | null {
  const timed = metas
    .filter((meta) => meta.captureTime !== null)
    .toSorted(
      (left, right) => (left.captureTime?.getTime() ?? 0) - (right.captureTime?.getTime() ?? 0),
    )
  if (timed.length < 2) {
    return null
  }
  let maxGapMs = 0
  let splitIndex = 0
  for (let index = 1; index < timed.length; index += 1) {
    const gap =
      (timed[index]?.captureTime?.getTime() ?? 0) - (timed[index - 1]?.captureTime?.getTime() ?? 0)
    if (gap > maxGapMs) {
      maxGapMs = gap
      splitIndex = index
    }
  }
  const maxGapMinutes = maxGapMs / 60_000
  if (maxGapMinutes <= SESSION_GAP_MINUTES) {
    return null
  }
  const offenders = smallerSide(timed.slice(0, splitIndex), timed.slice(splitIndex))
  return {
    kind: "time_gap",
    maxGapMinutes: Math.round(maxGapMinutes),
    offenders: offenders.map((meta) => meta.key),
  }
}

function detectCameraMismatch(metas: readonly SessionPhotoMeta[]): SessionMixupSignal | null {
  const groups = new Map<string, SessionPhotoMeta[]>()
  for (const meta of metas) {
    if (meta.camera === null) {
      continue
    }
    const group = groups.get(meta.camera) ?? []
    group.push(meta)
    groups.set(meta.camera, group)
  }
  if (groups.size < 2) {
    return null
  }
  const [majorityCamera] = [...groups.entries()].toSorted(
    (left, right) => right[1].length - left[1].length,
  )[0] ?? [null]
  const offenders = [...groups.entries()]
    .filter(([camera]) => camera !== majorityCamera)
    .flatMap(([, group]) => group.map((meta) => meta.key))
  return {
    kind: "camera_mismatch",
    cameras: [...groups.keys()],
    offenders,
  }
}

const SEQUENCE_PATTERN = /^(.*?)(\d+)\.[^.]+$/

function detectSequenceGap(metas: readonly SessionPhotoMeta[]): SessionMixupSignal | null {
  if (metas.length < 2) {
    return null
  }
  const parsed = metas.map((meta) => {
    const match = SEQUENCE_PATTERN.exec(meta.fileName)
    return match === undefined || match === null
      ? null
      : { meta, number: Number(match[2]), prefix: (match[1] ?? "").toLowerCase() }
  })
  if (parsed.some((entry) => entry === null)) {
    return null
  }
  const entries = parsed.filter((entry) => entry !== null)
  const prefixes = new Set(entries.map((entry) => entry.prefix))
  if (prefixes.size !== 1) {
    return null
  }
  const ordered = entries.toSorted((left, right) => left.number - right.number)
  let maxGap = 0
  let splitIndex = 0
  for (let index = 1; index < ordered.length; index += 1) {
    const gap = (ordered[index]?.number ?? 0) - (ordered[index - 1]?.number ?? 0)
    if (gap > maxGap) {
      maxGap = gap
      splitIndex = index
    }
  }
  if (maxGap <= SEQUENCE_NUMBER_GAP) {
    return null
  }
  const offenders = smallerSide(ordered.slice(0, splitIndex), ordered.slice(splitIndex))
  return { kind: "sequence_gap", offenders: offenders.map((entry) => entry.meta.key) }
}

export function detectSessionMixup(
  metas: readonly SessionPhotoMeta[],
): readonly SessionMixupSignal[] {
  return [detectTimeGap(metas), detectCameraMismatch(metas), detectSequenceGap(metas)].filter(
    (signal): signal is SessionMixupSignal => signal !== null,
  )
}
