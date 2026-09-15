import type { FileBoundaryError } from "../domain/files"
import type { WorkspaceMessage } from "./workspace-types"

export function workspaceFileBoundaryMessage(error: FileBoundaryError): WorkspaceMessage {
  switch (error.code) {
    case "raw_unsupported":
      return {
        kind: "error",
        title: "RAW 파일은 지원하지 않습니다",
        text: `${error.fileName}은(는) 카메라 원본(RAW) 형식입니다. 카메라가 함께 저장한 JPEG 파일을 사용하세요.`,
      }
    case "heic_unsupported":
      return {
        kind: "error",
        title: "아이폰 HEIC 사진은 아직 지원하지 않습니다",
        text: "카메라 설정을 '높은 호환성(JPEG)'으로 바꾸거나 JPEG로 변환해 주세요.",
      }
    case "too_many":
      return {
        kind: "warning",
        title: "사진은 최대 12장까지 선택할 수 있습니다",
        text: `${error.actual}장이 선택되었습니다. 7장을 넘는 사진은 예비로 보관되니 12장 이내로 골라 주세요.`,
      }
    default:
      return {
        kind: "error",
        title: "파일을 확인해 주세요",
        text: "JPG, PNG, WebP 형식의 사진을 파일당 50MB 이하로 선택해 주세요.",
      }
  }
}
