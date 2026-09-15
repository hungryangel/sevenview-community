type ByteOrder = "little" | "big"

const EXIF_DATE_TIME_ORIGINAL = 0x9003
const EXIF_SUB_IFD_POINTER = 0x8769
const IFD0_CAMERA_MAKE = 0x010f
const IFD0_CAMERA_MODEL = 0x0110

export type ExifSummary = {
  readonly cameraMake: string | null
  readonly cameraModel: string | null
  readonly captureTime: Date | null
}

const EMPTY_EXIF_SUMMARY: ExifSummary = {
  cameraMake: null,
  cameraModel: null,
  captureTime: null,
}
const JPEG_SOI = [0xff, 0xd8] as const
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

function hasPrefix(bytes: Uint8Array, prefix: readonly number[], start = 0): boolean {
  return prefix.every((value, index) => bytes[start + index] === value)
}

function readUint16(view: DataView, offset: number, byteOrder: ByteOrder): number | null {
  if (offset < 0 || offset + 2 > view.byteLength) {
    return null
  }
  return view.getUint16(offset, byteOrder === "little")
}

function readUint32(view: DataView, offset: number, byteOrder: ByteOrder): number | null {
  if (offset < 0 || offset + 4 > view.byteLength) {
    return null
  }
  return view.getUint32(offset, byteOrder === "little")
}

function readByte(bytes: Uint8Array, offset: number): number | null {
  return bytes[offset] ?? null
}

function fieldByteLength(type: number, count: number): number | null {
  const unitLength =
    type === 1 || type === 2 || type === 7
      ? 1
      : type === 3
        ? 2
        : type === 4 || type === 9
          ? 4
          : type === 5 || type === 10
            ? 8
            : null
  if (unitLength === null || count < 0 || count > Number.MAX_SAFE_INTEGER / unitLength) {
    return null
  }
  return unitLength * count
}

type IfdField = {
  readonly count: number
  readonly offset: number
  readonly tag: number
  readonly type: number
  readonly valueOffset: number
}

function readIfdFields(
  view: DataView,
  ifdOffset: number,
  byteOrder: ByteOrder,
): readonly IfdField[] | null {
  const fieldCount = readUint16(view, ifdOffset, byteOrder)
  if (fieldCount === null || ifdOffset + 2 + fieldCount * 12 + 4 > view.byteLength) {
    return null
  }
  const fields: IfdField[] = []
  for (let index = 0; index < fieldCount; index += 1) {
    const offset = ifdOffset + 2 + index * 12
    const tag = readUint16(view, offset, byteOrder)
    const type = readUint16(view, offset + 2, byteOrder)
    const count = readUint32(view, offset + 4, byteOrder)
    const valueOffset = readUint32(view, offset + 8, byteOrder)
    if (tag === null || type === null || count === null || valueOffset === null) {
      return null
    }
    fields.push({ count, offset, tag, type, valueOffset })
  }
  return fields
}

function readAscii(bytes: Uint8Array, field: IfdField, byteOrder: ByteOrder): string | null {
  if (field.type !== 2) {
    return null
  }
  const length = fieldByteLength(field.type, field.count)
  if (length === null) {
    return null
  }
  const offset = length <= 4 ? field.offset + 8 : field.valueOffset
  if (offset < 0 || offset + length > bytes.length) {
    return null
  }
  // ASCII has no byte-order dependence; accepting this argument makes call-sites explicit.
  void byteOrder
  return new TextDecoder("ascii")
    .decode(bytes.subarray(offset, offset + length))
    .replace(/\0.*$/, "")
}

function dateFromExif(value: string): Date | null {
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value)
  if (match === null) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const date = new Date(year, month - 1, day, hour, minute, second)
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute &&
    date.getSeconds() === second
    ? date
    : null
}

function cleanAscii(value: string | null): string | null {
  if (value === null) {
    return null
  }
  const collapsed = value.replace(/\s+/g, " ").trim()
  return collapsed === "" ? null : collapsed
}

function parseTiffSummary(tiffBytes: Uint8Array): ExifSummary {
  if (tiffBytes.length < 8) {
    return EMPTY_EXIF_SUMMARY
  }
  const byteOrder = hasPrefix(tiffBytes, [0x49, 0x49])
    ? "little"
    : hasPrefix(tiffBytes, [0x4d, 0x4d])
      ? "big"
      : null
  if (byteOrder === null) {
    return EMPTY_EXIF_SUMMARY
  }
  const view = new DataView(tiffBytes.buffer, tiffBytes.byteOffset, tiffBytes.byteLength)
  if (readUint16(view, 2, byteOrder) !== 42) {
    return EMPTY_EXIF_SUMMARY
  }
  const ifd0Offset = readUint32(view, 4, byteOrder)
  if (ifd0Offset === null) {
    return EMPTY_EXIF_SUMMARY
  }
  const ifd0Fields = readIfdFields(view, ifd0Offset, byteOrder)
  const makeField = ifd0Fields?.find((field) => field.tag === IFD0_CAMERA_MAKE)
  const modelField = ifd0Fields?.find((field) => field.tag === IFD0_CAMERA_MODEL)
  const cameraMake =
    makeField === undefined ? null : cleanAscii(readAscii(tiffBytes, makeField, byteOrder))
  const cameraModel =
    modelField === undefined ? null : cleanAscii(readAscii(tiffBytes, modelField, byteOrder))

  const exifPointer = ifd0Fields?.find((field) => field.tag === EXIF_SUB_IFD_POINTER)
  if (exifPointer === undefined || exifPointer.type !== 4 || exifPointer.count !== 1) {
    return { cameraMake, cameraModel, captureTime: null }
  }
  const exifFields = readIfdFields(view, exifPointer.valueOffset, byteOrder)
  const original = exifFields?.find((field) => field.tag === EXIF_DATE_TIME_ORIGINAL)
  const captureTime =
    original === undefined ? null : dateFromExif(readAscii(tiffBytes, original, byteOrder) ?? "")
  return { cameraMake, cameraModel, captureTime }
}

function findJpegTiff(bytes: Uint8Array): Uint8Array | null {
  if (!hasPrefix(bytes, JPEG_SOI)) {
    return null
  }
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null
    }
    const marker = bytes[offset + 1]
    if (marker === 0xd9 || marker === 0xda) {
      return null
    }
    const lengthHigh = readByte(bytes, offset + 2)
    const lengthLow = readByte(bytes, offset + 3)
    if (lengthHigh === null || lengthLow === null) {
      return null
    }
    const segmentLength = (lengthHigh << 8) | lengthLow
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) {
      return null
    }
    const payloadStart = offset + 4
    const payloadEnd = offset + 2 + segmentLength
    if (marker === 0xe1 && hasPrefix(bytes, [0x45, 0x78, 0x69, 0x66, 0, 0], payloadStart)) {
      return bytes.subarray(payloadStart + 6, payloadEnd)
    }
    offset = payloadEnd
  }
  return null
}

function readBigEndianUint32(bytes: Uint8Array, offset: number): number | null {
  if (offset + 4 > bytes.length) {
    return null
  }
  const first = readByte(bytes, offset)
  const second = readByte(bytes, offset + 1)
  const third = readByte(bytes, offset + 2)
  const fourth = readByte(bytes, offset + 3)
  if (first === null || second === null || third === null || fourth === null) {
    return null
  }
  return (first << 24) | (second << 16) | (third << 8) | fourth
}

function findPngTiff(bytes: Uint8Array): Uint8Array | null {
  if (!hasPrefix(bytes, PNG_SIGNATURE)) {
    return null
  }
  let offset = PNG_SIGNATURE.length
  while (offset + 12 <= bytes.length) {
    const length = readBigEndianUint32(bytes, offset)
    if (length === null || length < 0 || offset + 12 + length > bytes.length) {
      return null
    }
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (type === "eXIf") {
      return bytes.subarray(offset + 8, offset + 8 + length)
    }
    offset += 12 + length
  }
  return null
}

function findWebpTiff(bytes: Uint8Array): Uint8Array | null {
  if (
    !hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) ||
    !hasPrefix(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return null
  }
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.subarray(offset, offset + 4))
    const first = readByte(bytes, offset + 4)
    const second = readByte(bytes, offset + 5)
    const third = readByte(bytes, offset + 6)
    const fourth = readByte(bytes, offset + 7)
    if (first === null || second === null || third === null || fourth === null) {
      return null
    }
    const length = first | (second << 8) | (third << 16) | (fourth << 24)
    if (length < 0 || offset + 8 + length > bytes.length) {
      return null
    }
    if (type === "EXIF") {
      return bytes.subarray(offset + 8, offset + 8 + length)
    }
    offset += 8 + length + (length % 2)
  }
  return null
}

export function parseExifSummary(bytes: Uint8Array): ExifSummary {
  return parseTiffSummary(
    findJpegTiff(bytes) ?? findPngTiff(bytes) ?? findWebpTiff(bytes) ?? new Uint8Array(),
  )
}

export function parseExifCaptureTime(bytes: Uint8Array): Date | null {
  return parseExifSummary(bytes).captureTime
}

export async function readExifSummary(file: File): Promise<ExifSummary> {
  return parseExifSummary(new Uint8Array(await file.arrayBuffer()))
}

export async function readExifCaptureTime(file: File): Promise<Date | null> {
  return (await readExifSummary(file)).captureTime
}

export type SummarizedFile = {
  readonly file: File
  readonly summary: ExifSummary
}

export async function summarizeFilesByCaptureTime(
  files: readonly File[],
): Promise<readonly SummarizedFile[]> {
  const summarized = await Promise.all(
    files.map(async (file, index) => ({
      file,
      index,
      summary: await readExifSummary(file),
    })),
  )
  return [...summarized]
    .sort((left, right) => {
      const leftTime = left.summary.captureTime
      const rightTime = right.summary.captureTime
      if (leftTime !== null && rightTime !== null) {
        const difference = leftTime.getTime() - rightTime.getTime()
        return difference === 0 ? left.index - right.index : difference
      }
      if (leftTime !== null) {
        return -1
      }
      if (rightTime !== null) {
        return 1
      }
      return left.file.name.localeCompare(right.file.name, "ko") || left.index - right.index
    })
    .map(({ file, summary }) => ({ file, summary }))
}

export async function sortFilesByCaptureTime(files: readonly File[]): Promise<readonly File[]> {
  return (await summarizeFilesByCaptureTime(files)).map(({ file }) => file)
}
