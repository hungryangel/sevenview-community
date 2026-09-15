import type { AnalysisFailureCode } from "../domain/types"
import type { DecodedPhoto } from "../services/analyze-batch"
import { FaceDetectionError } from "./face-error"

export class ImageDecodeError extends Error {
  readonly name = "ImageDecodeError"

  constructor(cause?: unknown) {
    super("The selected image could not be decoded", { cause })
  }
}

// 표시·분석 파이프라인이 상주시키는 비트맵의 장변 상한. 내보내기 최대 타깃이 개별 PNG
// 800×1000이므로 2048이면 어떤 내보내기도 업스케일 없이 커버한다. 24MP급 DSLR 원본
// 7장을 그대로 상주시키면 비압축 기준 약 96MB×7인 반면, 축소본은 장당 약 12MB다.
// 원본 파일은 수정되지 않으며 축소본은 파생 표시본일 뿐이다.
export const DISPLAY_MAX_EDGE = 2048

export function scaledDecodeSize(
  width: number,
  height: number,
  maxEdge: number = DISPLAY_MAX_EDGE,
): { readonly width: number; readonly height: number } | null {
  const longEdge = Math.max(width, height)
  if (longEdge <= maxEdge || longEdge === 0) {
    return null
  }
  const scale = maxEdge / longEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export async function decodeImageFile(file: File): Promise<DecodedPhoto<ImageBitmap>> {
  try {
    const fullImage = await createImageBitmap(file, { imageOrientation: "from-image" })
    const scaled = scaledDecodeSize(fullImage.width, fullImage.height)
    if (scaled === null) {
      return { image: fullImage, width: fullImage.width, height: fullImage.height }
    }
    try {
      const scaledImage = await createImageBitmap(fullImage, {
        resizeHeight: scaled.height,
        resizeQuality: "high",
        resizeWidth: scaled.width,
      })
      return { image: scaledImage, width: scaledImage.width, height: scaledImage.height }
    } finally {
      fullImage.close()
    }
  } catch (error: unknown) {
    throw new ImageDecodeError(error)
  }
}

export function classifyPhotoError(error: unknown): AnalysisFailureCode {
  if (error instanceof ImageDecodeError) {
    return "decode_failed"
  }
  if (error instanceof FaceDetectionError) {
    return "face_not_detected"
  }
  return "analysis_failed"
}
