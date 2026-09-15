import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

import { drawCroppedImage } from "../adapters/canvas"
import type { FramingPreset } from "../domain/protocol-preset"
import { projectPointToTarget } from "../domain/render-plan"
import type { CropInstruction, Point } from "../domain/types"
import type { WorkspacePhoto } from "../domain/workspace"
import { VIEW_LABELS } from "../domain/workspace"
import {
  buildWorkspaceRenderModel,
  workspaceRenderInstruction,
} from "../domain/workspace-render-model"
import { CropEditorContext } from "./crop-editor-context"

export type CropAlignment = "aligned" | "original"

type CropPreviewProps = {
  readonly alignment?: CropAlignment
  readonly framing: FramingPreset
  // 2점 수평 확인 단계: 두 점을 잇는 선(캔버스 좌표).
  readonly line?: readonly [Point, Point] | undefined
  // 확대경: 포인터가 올라간 자리를 3배로 보여준다(인스펙터 미리보기용).
  readonly magnifier?: boolean
  // 기준선 2점 수평 보조: 찍은 점(캔버스 좌표)과, 클릭을 받을 콜백(있을 때만 클릭 가능).
  readonly marks?: readonly Point[]
  readonly onPointPick?: ((point: Point) => void) | undefined
  readonly photo: WorkspacePhoto<CanvasImageSource>
  readonly quality?: "compact" | "review"
  readonly showCropGuide?: boolean
  readonly showCenterGuide?: boolean
  readonly editing?: boolean
  readonly showEyeGuide?: boolean
  readonly zoom?: number
}

const TARGET = { width: 400, height: 500 } as const

// 확대경 크기(CSS 9.5rem=152px)·배율·원본 대비 2배 백킹 스토어.
export const LOUPE_SIZE_PX = 152
export const LOUPE_ZOOM = 3
const LOUPE_BACKING_SCALE = 2
const LOUPE_OFFSET_PX = 24

// 눈높이 기준선: 양안 중점을 실제 크롭 변환에 투영한 위치에 긋는다(고정 비율 아님).
// 프레임을 벗어나면(눈이 크롭 밖) 그리지 않는다.
function eyeGuideTopPercent(
  photo: WorkspacePhoto<CanvasImageSource>,
  crop: CropInstruction,
): number | null {
  const eyeCenter = photo.pose.eyeCenter
  if (eyeCenter === undefined) return null
  const projected = projectPointToTarget(crop, {
    x: eyeCenter.x * photo.sourceSize.width,
    y: eyeCenter.y * photo.sourceSize.height,
  })
  const percent = (projected.y / crop.targetSize.height) * 100
  return percent !== null && percent >= 2 && percent <= 98 ? percent : null
}

function isDetachedBitmap(image: CanvasImageSource): boolean {
  // 닫힌(detached) ImageBitmap은 drawImage가 InvalidStateError를 던져 React 트리가
  // 통째로 내려간다(2026-09-02 HMR 새로고침에서 재현). 그리지 않고 넘어간다.
  return typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap && image.width === 0
}

// 화면(client) 좌표 → 400×500 캔버스 좌표. 레이아웃이 없는 환경(크기 0)에선 null.
function canvasPointFromEvent(
  event: ReactPointerEvent<HTMLCanvasElement> | ReactMouseEvent<HTMLCanvasElement>,
): Point | null {
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    return null
  }
  return {
    x: ((event.clientX - rect.left) / rect.width) * TARGET.width,
    y: ((event.clientY - rect.top) / rect.height) * TARGET.height,
  }
}

// 확대경은 포인터 오른쪽 위에 두고, 화면 가장자리에 닿으면 반대편으로 넘긴다.
export function loupePosition(
  client: Point,
  viewport: { readonly width: number; readonly height: number },
  size = LOUPE_SIZE_PX,
  offset = LOUPE_OFFSET_PX,
): { readonly left: number; readonly top: number } {
  const left =
    client.x + offset + size > viewport.width ? client.x - offset - size : client.x + offset
  const top = client.y - offset - size < 0 ? client.y + offset : client.y - offset - size
  return { left, top }
}

export function CropPreview({
  alignment = "aligned",
  framing,
  line,
  magnifier = false,
  marks = [],
  onPointPick,
  photo,
  quality = "compact",
  showCropGuide = true,
  showCenterGuide = false,
  editing = false,
  showEyeGuide = false,
  zoom = 1,
}: CropPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loupeRef = useRef<HTMLCanvasElement>(null)
  const [loupe, setLoupe] = useState<{ readonly canvas: Point; readonly client: Point } | null>(
    null,
  )
  const model = useMemo(
    () => buildWorkspaceRenderModel({ alignment, framing, photo }),
    [alignment, framing, photo],
  )
  const crop = useMemo(() => workspaceRenderInstruction(model, TARGET), [model])
  const eyeGuideTop = showEyeGuide ? eyeGuideTopPercent(photo, crop) : null
  const showAlignedGuides = alignment === "aligned"

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (canvas === null || context === null || context === undefined) {
      return
    }
    if (isDetachedBitmap(photo.image)) {
      return
    }
    drawCroppedImage(context, photo.image, crop)
  }, [photo.image, crop])

  // 확대경: 같은 크롭 변환을 포인터 자리 기준으로 3배 확대해 원본 해상도로 다시 그린다.
  useEffect(() => {
    if (loupe === null) {
      return
    }
    const context = loupeRef.current?.getContext("2d")
    if (context === null || context === undefined || isDetachedBitmap(photo.image)) {
      return
    }
    const size = LOUPE_SIZE_PX * LOUPE_BACKING_SCALE
    context.save()
    context.clearRect(0, 0, size, size)
    context.translate(size / 2, size / 2)
    context.scale(LOUPE_ZOOM * LOUPE_BACKING_SCALE, LOUPE_ZOOM * LOUPE_BACKING_SCALE)
    context.translate(-loupe.canvas.x, -loupe.canvas.y)
    drawCroppedImage(context, photo.image, crop)
    context.restore()
  }, [loupe, photo.image, crop])

  const handlePointerMove = magnifier
    ? (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const point = canvasPointFromEvent(event)
        setLoupe(
          point === null ? null : { canvas: point, client: { x: event.clientX, y: event.clientY } },
        )
      }
    : undefined
  const handlePointerLeave = magnifier ? () => setLoupe(null) : undefined

  const loupePlacement =
    loupe === null
      ? null
      : loupePosition(loupe.client, { width: window.innerWidth, height: window.innerHeight })

  return (
    <div className={`crop-preview-shell${editing ? " crop-preview-shell--editing" : ""}`}>
      <div className="crop-preview-zoom-group" style={{ transform: `scale(${zoom})` }}>
        {editing && showCropGuide ? <CropEditorContext crop={crop} image={photo.image} /> : null}
        <div className="crop-preview-frame">
          <canvas
            aria-label={`${VIEW_LABELS[photo.view]} ${alignment === "original" ? "원본" : "표준 크롭"} 미리보기`}
            className={`crop-preview crop-preview--${quality}${onPointPick === undefined ? "" : " crop-preview--picking"}${magnifier ? " crop-preview--magnifier" : ""}`}
            height={TARGET.height}
            onClick={
              onPointPick === undefined
                ? undefined
                : (event) => {
                    const point = canvasPointFromEvent(event)
                    if (point !== null) {
                      onPointPick(point)
                    }
                  }
            }
            onPointerLeave={handlePointerLeave}
            onPointerMove={handlePointerMove}
            ref={canvasRef}
            role="img"
            width={TARGET.width}
          >
            {VIEW_LABELS[photo.view]} 표준 크롭 미리보기
          </canvas>
          {showAlignedGuides && showCropGuide ? (
            <span aria-hidden="true" className="crop-preview__crop-guide" />
          ) : null}
          {showAlignedGuides && showCenterGuide ? (
            <span aria-hidden="true" className="crop-preview__center-guide" />
          ) : null}
          {line === undefined ? null : (
            <svg
              aria-hidden="true"
              className="crop-preview__line"
              viewBox={`0 0 ${TARGET.width} ${TARGET.height}`}
            >
              <line x1={line[0].x} x2={line[1].x} y1={line[0].y} y2={line[1].y} />
            </svg>
          )}
          {marks.map((mark, index) => (
            <span
              aria-hidden="true"
              className="crop-preview__mark"
              key={`${mark.x.toFixed(1)}-${mark.y.toFixed(1)}`}
              style={{
                left: `${(mark.x / TARGET.width) * 100}%`,
                top: `${(mark.y / TARGET.height) * 100}%`,
              }}
            >
              {index + 1}
            </span>
          ))}
          {eyeGuideTop === null ? null : (
            <span
              aria-hidden="true"
              className="crop-preview__eye-guide"
              style={{ top: `${eyeGuideTop}%` }}
            />
          )}
        </div>
      </div>
      {editing ? (
        <span
          className="crop-preview__cut-label"
          style={{ visibility: showCropGuide ? "visible" : "hidden" }}
        >
          프레임 밖은 저장 시 잘립니다
        </span>
      ) : null}
      {loupe === null || loupePlacement === null
        ? null
        : createPortal(
            <div
              className="crop-loupe"
              style={{ insetBlockStart: loupePlacement.top, insetInlineStart: loupePlacement.left }}
            >
              <canvas
                aria-label={`확대경 ${LOUPE_ZOOM}배`}
                height={LOUPE_SIZE_PX * LOUPE_BACKING_SCALE}
                ref={loupeRef}
                role="img"
                width={LOUPE_SIZE_PX * LOUPE_BACKING_SCALE}
              >
                확대경 {LOUPE_ZOOM}배
              </canvas>
              <span className="crop-loupe__label">{LOUPE_ZOOM}×</span>
            </div>,
            document.body,
          )}
    </div>
  )
}
