// STORE 전용 ZIP 작성기(압축 없음 — PNG는 이미 압축돼 있다).
//
// 브라우저는 사용자 제스처 하나에 자동 다운로드 여러 개를 허용하지 않아,
// 개별 7장을 연속 내려받기하면 두 번째부터
// 조용히 차단된다. 여러 파일 내보내기는 항상 ZIP 한 파일로 묶는다.
// 외부 의존성 금지 정책에 따라 최소 구현이며, 파일명은 UTF-8 플래그(bit 11)로 기록한다.

export type ZipEntry = {
  readonly name: string
  readonly data: Uint8Array
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosTimeParts(now: Date): { readonly time: number; readonly date: number } {
  return {
    time: (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1),
    date:
      ((Math.max(1980, now.getFullYear()) - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate(),
  }
}

const LOCAL_HEADER_SIZE = 30
const CENTRAL_HEADER_SIZE = 46
const END_RECORD_SIZE = 22
const UTF8_NAME_FLAG = 0x0800

export function buildZipStore(
  entries: readonly ZipEntry[],
  now: Date = new Date(),
): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const prepared = entries.map((entry) => ({
    nameBytes: encoder.encode(entry.name),
    data: entry.data,
    crc: crc32(entry.data),
  }))
  const { time, date } = dosTimeParts(now)

  const localSize = prepared.reduce(
    (sum, entry) => sum + LOCAL_HEADER_SIZE + entry.nameBytes.length + entry.data.length,
    0,
  )
  const centralSize = prepared.reduce(
    (sum, entry) => sum + CENTRAL_HEADER_SIZE + entry.nameBytes.length,
    0,
  )
  const output = new Uint8Array(localSize + centralSize + END_RECORD_SIZE)
  const view = new DataView(output.buffer)
  let offset = 0
  const localOffsets: number[] = []

  for (const entry of prepared) {
    localOffsets.push(offset)
    view.setUint32(offset, 0x04034b50, true)
    view.setUint16(offset + 4, 20, true)
    view.setUint16(offset + 6, UTF8_NAME_FLAG, true)
    view.setUint16(offset + 8, 0, true)
    view.setUint16(offset + 10, time, true)
    view.setUint16(offset + 12, date, true)
    view.setUint32(offset + 14, entry.crc, true)
    view.setUint32(offset + 18, entry.data.length, true)
    view.setUint32(offset + 22, entry.data.length, true)
    view.setUint16(offset + 26, entry.nameBytes.length, true)
    view.setUint16(offset + 28, 0, true)
    output.set(entry.nameBytes, offset + LOCAL_HEADER_SIZE)
    output.set(entry.data, offset + LOCAL_HEADER_SIZE + entry.nameBytes.length)
    offset += LOCAL_HEADER_SIZE + entry.nameBytes.length + entry.data.length
  }

  const centralOffset = offset
  for (const [index, entry] of prepared.entries()) {
    view.setUint32(offset, 0x02014b50, true)
    view.setUint16(offset + 4, 20, true)
    view.setUint16(offset + 6, 20, true)
    view.setUint16(offset + 8, UTF8_NAME_FLAG, true)
    view.setUint16(offset + 10, 0, true)
    view.setUint16(offset + 12, time, true)
    view.setUint16(offset + 14, date, true)
    view.setUint32(offset + 16, entry.crc, true)
    view.setUint32(offset + 20, entry.data.length, true)
    view.setUint32(offset + 24, entry.data.length, true)
    view.setUint16(offset + 28, entry.nameBytes.length, true)
    view.setUint16(offset + 30, 0, true)
    view.setUint16(offset + 32, 0, true)
    view.setUint16(offset + 34, 0, true)
    view.setUint16(offset + 36, 0, true)
    view.setUint32(offset + 38, 0, true)
    view.setUint32(offset + 42, localOffsets[index] as number, true)
    output.set(entry.nameBytes, offset + CENTRAL_HEADER_SIZE)
    offset += CENTRAL_HEADER_SIZE + entry.nameBytes.length
  }

  view.setUint32(offset, 0x06054b50, true)
  view.setUint16(offset + 4, 0, true)
  view.setUint16(offset + 6, 0, true)
  view.setUint16(offset + 8, prepared.length, true)
  view.setUint16(offset + 10, prepared.length, true)
  view.setUint32(offset + 12, offset - centralOffset, true)
  view.setUint32(offset + 16, centralOffset, true)
  view.setUint16(offset + 20, 0, true)

  return output
}
