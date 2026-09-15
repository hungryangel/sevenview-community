import { photoId, type ViewId } from "../src/domain/types"
import { VIEW_SETS } from "../src/domain/view-set"
import { DEFAULT_CROP_ADJUSTMENT } from "../src/domain/workspace"
import type { useWorkspace } from "../src/product/use-workspace"

type Workspace = ReturnType<typeof useWorkspace>

export function overviewPhoto(view: ViewId): Workspace["photos"][number] {
  return {
    adjustment: DEFAULT_CROP_ADJUSTMENT,
    assignmentMethod: "auto",
    image: document.createElement("canvas"),
    pose: {
      anchor: { x: 0.5, y: 0.5 },
      bounds: { bottom: 0.85, left: 0.25, right: 0.75, top: 0.15 },
      confidence: 0.94,
      id: photoId(view),
      pitchScore: 0,
      rollDegrees: 0,
      yawScore: 0,
    },
    sourceSize: { height: 1000, width: 800 },
    view,
  }
}

export function overviewFailure(view: ViewId): Workspace["failures"][number] {
  return {
    code: "face_not_detected",
    decoded: null,
    file: new File(["fixture"], `${view}.png`, { type: "image/png" }),
    fileName: `${view}.png`,
    view,
  }
}

export function overviewWorkspace() {
  return {
    exporting: false,
    failures: [],
    getPhotoMeta: () => undefined,
    newSetAnalyzing: false,
    photos: [],
    selectedView: "front",
    sessionName: "2026-09-09_0830",
    setSessionName: (_value: string) => undefined,
    spares: [],
    trayFailures: [],
    viewSet: VIEW_SETS.standardSeven,
  } satisfies Pick<
    Workspace,
    | "exporting"
    | "failures"
    | "getPhotoMeta"
    | "newSetAnalyzing"
    | "photos"
    | "selectedView"
    | "sessionName"
    | "setSessionName"
    | "spares"
    | "trayFailures"
    | "viewSet"
  >
}
