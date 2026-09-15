import { z } from "zod"

// 현장은 "9장 찍고 7장 고르기"나 "5장뿐"인 세트가 흔하다(bee 확정 2026-09-01).
// 7장을 넘는 사진은 예비 트레이로, 모자란 뷰는 미촬영 빈 슬롯으로 다룬다.
const MAXIMUM_FILES = 12
const MAXIMUM_BYTES = 50 * 1024 * 1024

const ImageMetadataSchema = z.object({
  name: z.string().min(1),
  size: z.number().int().nonnegative().max(MAXIMUM_BYTES),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
})

const RAW_EXTENSIONS = new Set([
  "arw",
  "cr2",
  "cr3",
  "dng",
  "nef",
  "orf",
  "pef",
  "raf",
  "rw2",
  "srw",
])
const HEIC_EXTENSIONS = new Set(["heic", "heif"])
const HEIC_TYPES = new Set(["image/heic", "image/heic-sequence", "image/heif"])

function fileExtension(name: string): string {
  const dotIndex = name.lastIndexOf(".")
  return dotIndex < 0 ? "" : name.slice(dotIndex + 1).toLowerCase()
}

export type FileBoundaryError =
  | { readonly code: "too_many"; readonly maximum: number; readonly actual: number }
  | { readonly code: "unsupported_type"; readonly fileName: string }
  | { readonly code: "raw_unsupported"; readonly fileName: string }
  | { readonly code: "heic_unsupported"; readonly fileName: string }
  | { readonly code: "too_large"; readonly fileName: string; readonly maximumBytes: number }

type ParseImageFilesResult =
  | { readonly kind: "accepted"; readonly files: readonly File[] }
  | { readonly kind: "rejected"; readonly error: FileBoundaryError }

export function parseImageFiles(files: readonly File[]): ParseImageFilesResult {
  if (files.length > MAXIMUM_FILES) {
    return {
      kind: "rejected",
      error: { code: "too_many", maximum: MAXIMUM_FILES, actual: files.length },
    }
  }

  for (const file of files) {
    const extension = fileExtension(file.name)
    if (RAW_EXTENSIONS.has(extension)) {
      return {
        kind: "rejected",
        error: { code: "raw_unsupported", fileName: file.name },
      }
    }
    if (HEIC_EXTENSIONS.has(extension) || HEIC_TYPES.has(file.type)) {
      return {
        kind: "rejected",
        error: { code: "heic_unsupported", fileName: file.name },
      }
    }
    if (!ImageMetadataSchema.shape.type.safeParse(file.type).success) {
      return {
        kind: "rejected",
        error: { code: "unsupported_type", fileName: file.name },
      }
    }
    if (file.size > MAXIMUM_BYTES) {
      return {
        kind: "rejected",
        error: { code: "too_large", fileName: file.name, maximumBytes: MAXIMUM_BYTES },
      }
    }
    ImageMetadataSchema.parse({ name: file.name, size: file.size, type: file.type })
  }

  return { kind: "accepted", files }
}
