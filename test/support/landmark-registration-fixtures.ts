import { metricsFromDetection } from "../../src/adapters/mediapipe"
import { type PhotoPose, type Point, photoId } from "../../src/domain/types"

export function syntheticRegistrationMesh(): Point[] {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
  const specified = [
    [10, 0.49, 0.17],
    [168, 0.51, 0.34],
    [6, 0.52, 0.4],
    [33, 0.28, 0.36],
    [133, 0.42, 0.37],
    [159, 0.35, 0.34],
    [145, 0.35, 0.39],
    [263, 0.72, 0.38],
    [362, 0.6, 0.37],
    [386, 0.66, 0.35],
    [374, 0.66, 0.4],
    [1, 0.55, 0.54],
    [152, 0.52, 0.86],
    [234, 0.2, 0.57],
    [454, 0.8, 0.57],
  ] as const
  for (const [index, x, y] of specified) points[index] = { x, y }
  return points
}

export function syntheticRegistrationPose(points: readonly Point[]): PhotoPose {
  return { id: photoId("synthetic"), ...metricsFromDetection({ faceLandmarks: [points] }) }
}

export function moveSyntheticMesh(points: readonly Point[], degrees = 8): Point[] {
  const radians = (degrees * Math.PI) / 180
  return points.map(({ x, y }) => ({
    x: 0.52 + 1.2 * (Math.cos(radians) * (x - 0.5) - Math.sin(radians) * (y - 0.5)),
    y: 0.47 + 1.2 * (Math.sin(radians) * (x - 0.5) + Math.cos(radians) * (y - 0.5)),
  }))
}
