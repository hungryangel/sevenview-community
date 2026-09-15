// 모델 파일 무결성(2026-09-02 배포 보안처리): task 모델은 사진 픽셀을 직접 읽는 코드다.
// 배포된 파일이 고정 해시와 다르면(교체·손상·잘못된 배포) 분석을 시작하지 않는다.
export class ModelIntegrityError extends Error {
  readonly name = "ModelIntegrityError"

  constructor(
    readonly modelName: string,
    readonly expectedSha256: string,
    readonly actualSha256: string,
  ) {
    super(`Model integrity check failed for ${modelName}`)
  }
}

export class ModelFetchError extends Error {
  readonly name = "ModelFetchError"

  constructor(
    readonly modelName: string,
    readonly status: number,
  ) {
    super(`Model download failed for ${modelName} (HTTP ${status})`)
  }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function assertModelIntegrity(
  bytes: Uint8Array,
  expectedSha256: string,
  modelName: string,
): Promise<Uint8Array> {
  const actual = await sha256Hex(bytes)
  if (actual !== expectedSha256.toLowerCase()) {
    throw new ModelIntegrityError(modelName, expectedSha256.toLowerCase(), actual)
  }
  return bytes
}

export async function fetchVerifiedModel(
  url: string,
  expectedSha256: string,
  modelName: string,
): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new ModelFetchError(modelName, response.status)
  }
  return assertModelIntegrity(
    new Uint8Array(await response.arrayBuffer()),
    expectedSha256,
    modelName,
  )
}
