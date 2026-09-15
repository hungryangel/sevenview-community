export class FaceDetectionError extends Error {
  readonly name = "FaceDetectionError"

  constructor(readonly code: "no_face") {
    super("No face was detected in the image")
  }
}
