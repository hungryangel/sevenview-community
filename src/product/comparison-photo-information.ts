import type { ComparisonAngle } from "../domain/comparison"
import { projectPointToTarget } from "../domain/render-plan"
import type { Point } from "../domain/types"
import { comparisonReferenceLabels } from "./comparison-reference-labels"
import type { ComparisonRenderSide } from "./comparison-render-model"

const COMPARISON_PHOTO_INFORMATION_MODES = [
  "off",
  "registration",
  "faceRegion",
  "landmarks",
] as const
export type ComparisonPhotoInformationMode = (typeof COMPARISON_PHOTO_INFORMATION_MODES)[number]

type ProjectedPoint = Point & { readonly label: string }

export type ComparisonPhotoInformation =
  | { readonly kind: "off" }
  | { readonly kind: "unavailable" }
  | {
      readonly kind: "landmarks"
      readonly points: readonly (Point & { readonly id: number })[]
      readonly named: readonly ProjectedPoint[]
    }
  | {
      readonly kind: "registration"
      readonly points: readonly ProjectedPoint[]
      readonly provenance: "detected" | "manual"
    }
  | {
      readonly anchor: Point
      readonly kind: "faceRegion"
      readonly polygon: readonly [Point, Point, Point, Point]
    }

function finitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function normalizedPoint(point: Point): boolean {
  return finitePoint(point) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
}

function project(render: ComparisonRenderSide, point: Point): Point {
  const projected = projectPointToTarget(render.instruction, point)
  return {
    x: projected.x / render.instruction.targetSize.width,
    y: projected.y / render.instruction.targetSize.height,
  }
}

export function comparisonPhotoInformation(
  render: ComparisonRenderSide,
  mode: ComparisonPhotoInformationMode,
  angle: ComparisonAngle,
): ComparisonPhotoInformation {
  if (mode === "off") return { kind: "off" }
  const source = render.slot.decoded
  if (
    !Number.isFinite(source.width) ||
    !Number.isFinite(source.height) ||
    source.width <= 0 ||
    source.height <= 0
  ) {
    return { kind: "unavailable" }
  }
  if (mode === "registration") {
    if (render.projectedRegistrationPoints !== undefined) {
      const names = {
        forehead: "이마 중앙",
        chin: "턱끝",
        noseTip: "코끝",
        noseBridgeUpper: "콧등 위",
        noseBridgeLower: "콧등 아래",
        screenLeftCheek: "화면 왼쪽 얼굴 윤곽",
        screenRightCheek: "화면 오른쪽 얼굴 윤곽",
        screenLeftEyeOuter: "화면 왼쪽 눈 바깥",
        screenLeftEyeInner: "화면 왼쪽 눈 안쪽",
        screenLeftEyeUpper: "화면 왼쪽 눈 위",
        screenLeftEyeLower: "화면 왼쪽 눈 아래",
        screenRightEyeOuter: "화면 오른쪽 눈 바깥",
        screenRightEyeInner: "화면 오른쪽 눈 안쪽",
        screenRightEyeUpper: "화면 오른쪽 눈 위",
        screenRightEyeLower: "화면 오른쪽 눈 아래",
      } as const
      return {
        kind: "registration",
        provenance: "detected",
        points: render.projectedRegistrationPoints.map((point) => ({
          x: point.x / render.instruction.targetSize.width,
          y: point.y / render.instruction.targetSize.height,
          label: names[point.name],
        })),
      }
    }
    const labels = comparisonReferenceLabels(render, angle)
    const sourcePoints = [render.references.first, render.references.second] as const
    if (
      sourcePoints.some(
        (point) =>
          !finitePoint(point) ||
          point.x < 0 ||
          point.x > source.width ||
          point.y < 0 ||
          point.y > source.height,
      )
    ) {
      return { kind: "unavailable" }
    }
    const points: readonly [ProjectedPoint, ProjectedPoint] = [
      { ...project(render, sourcePoints[0]), label: labels[0] },
      { ...project(render, sourcePoints[1]), label: labels[1] },
    ]
    return points.every(finitePoint)
      ? { kind: "registration", points, provenance: render.provenance }
      : { kind: "unavailable" }
  }

  if (render.slot.kind === "manual") return { kind: "unavailable" }
  if (mode === "landmarks") {
    const geometry = render.slot.pose.landmarkGeometry
    if (geometry === undefined || geometry.points.some((point) => !finitePoint(point)))
      return { kind: "unavailable" }
    const projectNormalized = (point: Point) =>
      project(render, { x: point.x * source.width, y: point.y * source.height })
    const labels = [
      ["forehead", "이마 중앙"],
      ["noseBridgeUpper", "콧등 위"],
      ["noseTip", "코끝"],
      ["chin", "턱끝"],
      ["screenLeftCheek", "화면 왼쪽 얼굴 윤곽"],
      ["screenRightCheek", "화면 오른쪽 얼굴 윤곽"],
    ] as const
    return {
      kind: "landmarks",
      points: geometry.points.map((point, id) => ({ ...projectNormalized(point), id })),
      named: labels.map(([name, label]) => ({ ...projectNormalized(geometry.named[name]), label })),
    }
  }
  const bounds = render.slot.pose.bounds
  const anchor = render.slot.pose.anchor
  const validBounds =
    Number.isFinite(bounds.left) &&
    Number.isFinite(bounds.right) &&
    Number.isFinite(bounds.top) &&
    Number.isFinite(bounds.bottom) &&
    bounds.left >= 0 &&
    bounds.right <= 1 &&
    bounds.top >= 0 &&
    bounds.bottom <= 1 &&
    bounds.left < bounds.right &&
    bounds.top < bounds.bottom
  if (!validBounds || !normalizedPoint(anchor)) return { kind: "unavailable" }
  const toSourcePixels = (point: Point) => ({
    x: point.x * source.width,
    y: point.y * source.height,
  })
  const polygon: readonly [Point, Point, Point, Point] = [
    project(render, toSourcePixels({ x: bounds.left, y: bounds.top })),
    project(render, toSourcePixels({ x: bounds.right, y: bounds.top })),
    project(render, toSourcePixels({ x: bounds.right, y: bounds.bottom })),
    project(render, toSourcePixels({ x: bounds.left, y: bounds.bottom })),
  ]
  const projectedAnchor = project(render, toSourcePixels(anchor))
  return polygon.every(finitePoint) && finitePoint(projectedAnchor)
    ? { anchor: projectedAnchor, kind: "faceRegion", polygon }
    : { kind: "unavailable" }
}
