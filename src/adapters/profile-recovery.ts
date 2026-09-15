import type { FaceLandmarker, ImageSource } from "@mediapipe/tasks-vision"
import type { FaceMetrics, ImageSize } from "../domain/types"
import { throwIfAborted, yieldToBrowser } from "../services/browser-yield"
import { FaceDetectionError } from "./face-error"
import { metricsFromDetection } from "./mediapipe"
import {
  inverseRecoveryPoints,
  isPlausibleProfileRecovery,
  matchingRecovery,
  PROFILE_RECOVERY_PASSES,
  RECOVERY_CANVAS_SIZE,
  recoveryTransform,
} from "./profile-recovery-geometry"

function sourceSize(source: ImageSource): ImageSize {
  if ("videoWidth" in source) return { width: source.videoWidth, height: source.videoHeight }
  if ("naturalWidth" in source) return { width: source.naturalWidth, height: source.naturalHeight }
  if ("displayWidth" in source) return { width: source.displayWidth, height: source.displayHeight }
  return { width: source.width, height: source.height }
}

export async function recoverProfile(
  model: Pick<FaceLandmarker, "detect" | "setOptions">,
  image: ImageSource,
  signal?: AbortSignal,
): Promise<FaceMetrics> {
  const size = sourceSize(image)
  if (size.width <= 0 || size.height <= 0) throw new FaceDetectionError("no_face")
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = RECOVERY_CANVAS_SIZE
  const context = canvas.getContext("2d")
  if (context === null) throw new Error("Profile recovery canvas is unavailable")
  const candidates: FaceMetrics[] = []
  const drawable = image instanceof ImageData ? await createImageBitmap(image) : image
  try {
    await model.setOptions({ minFaceDetectionConfidence: 0.2, minFacePresenceConfidence: 0.2 })
    for (const pass of PROFILE_RECOVERY_PASSES) {
      await yieldToBrowser(signal)
      throwIfAborted(signal)
      const transform = recoveryTransform(size, pass)
      context.resetTransform()
      context.fillStyle = "#a8a8a8"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.save()
      context.translate(canvas.width / 2, canvas.height / 2)
      context.rotate(transform.radians)
      context.scale(transform.scale * (pass.mirror ? -1 : 1), transform.scale)
      context.drawImage(drawable, -size.width / 2, -size.height / 2)
      context.restore()
      const detected = model.detect(canvas).faceLandmarks[0]
      if (detected?.length !== 478) continue
      const points = inverseRecoveryPoints(detected, transform)
      const metrics = metricsFromDetection({ faceLandmarks: [points] })
      if (!isPlausibleProfileRecovery(metrics)) continue
      const stable = matchingRecovery(candidates, metrics)
      if (stable !== null) return { ...stable, detectionMethod: "profile_recovery" }
      candidates.push(metrics)
    }
    throw new FaceDetectionError("no_face")
  } finally {
    if (drawable !== image && drawable instanceof ImageBitmap) drawable.close()
    canvas.width = canvas.height = 1
    // One model is reused to avoid another WASM graph on low-memory devices. Never leave
    // its lowered discovery thresholds active for the next original photo.
    await model.setOptions({ minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5 })
  }
}
