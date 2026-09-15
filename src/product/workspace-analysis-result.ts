import { releaseImage } from "../adapters/image-resource"
import {
  missingWorkspaceViews,
  organizeVariableWorkspacePhotos,
  type WorkspaceFailure,
  type WorkspaceSourcePhoto,
} from "../domain/recovery"
import type { ViewId } from "../domain/types"
import type { ViewSet } from "../domain/view-set"
import type { WorkspacePhoto } from "../domain/workspace"
import type { PhotoBatchItem } from "../services/analyze-batch"

export type FailedWorkspacePhoto = WorkspaceFailure<CanvasImageSource> & {
  readonly file: File
}

export type SpareWorkspacePhoto = WorkspaceSourcePhoto<CanvasImageSource>

export type TrayFailure = {
  readonly code: FailedWorkspacePhoto["code"]
  readonly decoded: FailedWorkspacePhoto["decoded"]
  readonly file: File
  readonly fileName: string
}

export type WorkspaceContents = {
  readonly failures: readonly FailedWorkspacePhoto[]
  readonly photos: readonly WorkspacePhoto<CanvasImageSource>[]
  readonly spares: readonly SpareWorkspacePhoto[]
  readonly trayFailures: readonly TrayFailure[]
}

export const EMPTY_WORKSPACE_CONTENTS: WorkspaceContents = {
  failures: [],
  photos: [],
  spares: [],
  trayFailures: [],
}

function sourceImages(contents: WorkspaceContents): readonly CanvasImageSource[] {
  return [
    ...contents.photos.map((photo) => photo.image),
    ...contents.spares.map((spare) => spare.image),
    ...contents.failures.flatMap((failure) =>
      failure.decoded === null ? [] : [failure.decoded.image],
    ),
    ...contents.trayFailures.flatMap((failure) =>
      failure.decoded === null ? [] : [failure.decoded.image],
    ),
  ]
}

export function releaseDiscardedImages(current: WorkspaceContents, next: WorkspaceContents): void {
  const retained = sourceImages(next)
  for (const image of sourceImages(current)) {
    if (!retained.includes(image)) releaseImage(image)
  }
}

export function releaseDiscardedBatch(results: readonly PhotoBatchItem<CanvasImageSource>[]): void {
  const images = results.flatMap((result) =>
    result.decoded === null ? [] : [result.decoded.image],
  )
  for (const image of new Set(images)) releaseImage(image)
}

export function workspaceFromBatch(
  results: readonly PhotoBatchItem<CanvasImageSource>[],
  viewSet: ViewSet,
): WorkspaceContents {
  const sources = results.flatMap((result) =>
    result.kind === "ready"
      ? [
          {
            image: result.decoded.image,
            pose: result.pose,
            sourceSize: { width: result.decoded.width, height: result.decoded.height },
          },
        ]
      : [],
  )
  const assignment = organizeVariableWorkspacePhotos(sources, viewSet)
  const missingViews = missingWorkspaceViews(assignment.photos, viewSet)
  const failures: FailedWorkspacePhoto[] = []
  const trayFailures: TrayFailure[] = []

  for (const result of results) {
    if (result.kind !== "error") continue
    const decoded =
      result.decoded === null
        ? null
        : {
            image: result.decoded.image,
            sourceSize: { width: result.decoded.width, height: result.decoded.height },
          }
    const view = missingViews[failures.length]
    if (view === undefined) {
      trayFailures.push({
        code: result.code,
        decoded,
        file: result.file,
        fileName: result.file.name,
      })
      continue
    }
    failures.push({
      code: result.code,
      decoded,
      file: result.file,
      fileName: result.file.name,
      view,
    })
  }
  return { failures, photos: assignment.photos, spares: assignment.spares, trayFailures }
}

export function failureMetaKey(fileName: string): string {
  return `file:${fileName}`
}

export function defaultSelectedView(
  photos: readonly WorkspacePhoto<CanvasImageSource>[],
  failures: readonly FailedWorkspacePhoto[],
): ViewId {
  return photos[0]?.view ?? failures[0]?.view ?? "front"
}
