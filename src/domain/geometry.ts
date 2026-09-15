import type { FaceAnchors, FaceMetrics } from "./types"

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function analyzeFaceAnchors(anchors: FaceAnchors): FaceMetrics {
  const eyeDx = anchors.rightEye.x - anchors.leftEye.x
  const eyeDy = anchors.rightEye.y - anchors.leftEye.y
  const cheekWidth = anchors.rightCheek.x - anchors.leftCheek.x
  const cheekCenterX = (anchors.leftCheek.x + anchors.rightCheek.x) / 2
  const eyeCenterY = (anchors.leftEye.y + anchors.rightEye.y) / 2
  const eyeToChin = anchors.chin.y - eyeCenterY
  const faceHeight = anchors.chin.y - anchors.forehead.y
  const mouthWidth = Math.abs(anchors.mouthRight.x - anchors.mouthLeft.x)
  const lipGap = Math.max(0, anchors.lowerLipInner.y - anchors.upperLipInner.y)
  const smileScore =
    (cheekWidth === 0 ? 0 : mouthWidth / Math.abs(cheekWidth)) +
    (faceHeight === 0 ? 0 : lipGap / Math.abs(faceHeight))

  return {
    yawScore: cheekWidth === 0 ? 0 : (anchors.noseTip.x - cheekCenterX) / cheekWidth,
    pitchScore: eyeToChin === 0 ? 0 : (anchors.noseTip.y - eyeCenterY) / eyeToChin,
    rollDegrees: (Math.atan2(eyeDy, eyeDx) * 180) / Math.PI,
    confidence: clampUnit((Math.abs(cheekWidth) / 0.45) * (Math.abs(faceHeight) / 0.6)),
    bounds: {
      left: Math.min(anchors.leftCheek.x, anchors.rightCheek.x),
      top: Math.min(anchors.forehead.y, anchors.chin.y),
      right: Math.max(anchors.leftCheek.x, anchors.rightCheek.x),
      bottom: Math.max(anchors.forehead.y, anchors.chin.y),
    },
    eyeCenter: {
      x: (anchors.leftEye.x + anchors.rightEye.x) / 2,
      y: eyeCenterY,
    },
    registrationAnchors: {
      screenLeftEye: anchors.leftEye,
      screenRightEye: anchors.rightEye,
      noseTip: anchors.noseTip,
    },
    // 가로 중심 = 메시 전체 범위의 중점. 측면(90°)에서 뺨 중점은 귀 위치로 몰려 코가
    // 프레임 밖으로 밀리지 않도록 제한합니다.
    anchor: {
      x: (anchors.outline.left + anchors.outline.right) / 2,
      y: (anchors.forehead.y + anchors.chin.y) / 2,
    },
    smileScore,
  }
}
