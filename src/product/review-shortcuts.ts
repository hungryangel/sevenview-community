// 검토 화면 단축키(2026-09-03, Gemini 제안 중 채택분): 사진 편집 도구 관례를 따른다.
//  - `\`(Backslash)를 누르고 있는 동안 원본을 보여주고, 떼면 AI 정렬본으로 돌아온다
//    (라이트룸의 before/after). Space는 버튼 활성화·스크롤과 충돌해 쓰지 않는다.
//  - `[` / `]` 는 선택한 사진을 0.1°씩, Shift와 함께면 1°씩 반시계/시계 회전.
// 키 위치(event.code)로 판정해 한글 자판(₩)에서도 같은 자리가 먹는다. 입력 중이거나
// 대화상자가 열려 있으면 어떤 단축키도 동작하지 않는다.
export type ReviewShortcut =
  | "peekOriginal"
  | "rotateCcw"
  | "rotateCw"
  | "rotateCcwCoarse"
  | "rotateCwCoarse"

export type RotationShortcut = Exclude<ReviewShortcut, "peekOriginal">

export const ROTATION_SHORTCUT_STEP_DEGREES = 0.1
export const ROTATION_SHORTCUT_COARSE_STEP_DEGREES = 1

type KeyLike = {
  readonly altKey: boolean
  readonly code: string
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly shiftKey?: boolean
}

export function shortcutForKey(event: KeyLike): ReviewShortcut | null {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return null
  }
  const coarse = event.shiftKey === true
  switch (event.code) {
    case "Backslash":
      return coarse ? null : "peekOriginal"
    case "BracketLeft":
      return coarse ? "rotateCcwCoarse" : "rotateCcw"
    case "BracketRight":
      return coarse ? "rotateCwCoarse" : "rotateCw"
    default:
      return null
  }
}

// 글자를 입력하는 자리(입력창·텍스트 영역·셀렉트·편집 가능 요소)에서는 단축키를 먹지 않는다.
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable) {
    return true
  }
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}

export function rotateByShortcut(current: number, shortcut: RotationShortcut, limit = 12): number {
  const magnitude =
    shortcut === "rotateCcwCoarse" || shortcut === "rotateCwCoarse"
      ? ROTATION_SHORTCUT_COARSE_STEP_DEGREES
      : ROTATION_SHORTCUT_STEP_DEGREES
  const delta = shortcut === "rotateCw" || shortcut === "rotateCwCoarse" ? magnitude : -magnitude
  const next = Math.round((current + delta) * 10) / 10
  return Math.min(limit, Math.max(-limit, next))
}
