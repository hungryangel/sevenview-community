import { describe, expect, it } from "vitest"

import { buildZipStore, crc32 } from "../src/adapters/zip-store"

const encoder = new TextEncoder()

describe("crc32", () => {
  it("matches the standard IEEE check vector", () => {
    // "123456789" → 0xCBF43926 (CRC-32/ISO-HDLC 표준 검증 벡터).
    expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926)
  })
})

describe("buildZipStore", () => {
  it("writes a store-only zip with utf-8 names that a reader can walk", () => {
    const entries = [
      { name: "contact-sheet.png", data: encoder.encode("sheet-bytes") },
      { name: "1_정면.png", data: encoder.encode("front-bytes") },
    ]

    const zip = buildZipStore(entries, new Date(2026, 8, 1, 12, 30, 40))
    const view = new DataView(zip.buffer)

    // 첫 로컬 헤더: 시그니처·무압축(0)·UTF-8 플래그(bit 11)·크기·CRC.
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    expect(view.getUint16(6, true)).toBe(0x0800)
    expect(view.getUint16(8, true)).toBe(0)
    expect(view.getUint32(14, true)).toBe(crc32(entries[0]?.data as Uint8Array))
    expect(view.getUint32(18, true)).toBe(11)
    expect(view.getUint32(22, true)).toBe(11)

    // 로컬 헤더가 항목 수만큼 존재한다.
    let localHeaders = 0
    for (let offset = 0; offset + 4 <= zip.length; offset++) {
      if (view.getUint32(offset, true) === 0x04034b50) {
        localHeaders++
      }
    }
    expect(localHeaders).toBe(2)

    // EOCD: 파일 끝 22바이트, 총 항목 수와 central directory 오프셋이 맞는다.
    const eocd = zip.length - 22
    expect(view.getUint32(eocd, true)).toBe(0x06054b50)
    expect(view.getUint16(eocd + 8, true)).toBe(2)
    expect(view.getUint16(eocd + 10, true)).toBe(2)
    const centralOffset = view.getUint32(eocd + 16, true)
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50)

    // 한글 파일명이 UTF-8 바이트 그대로 들어간다.
    const nameBytes = encoder.encode("1_정면.png")
    const asString = Array.from(zip)
    const needle = Array.from(nameBytes)
    const contains = asString.some((_, index) =>
      needle.every((byte, offset) => asString[index + offset] === byte),
    )
    expect(contains).toBe(true)
  })
})
