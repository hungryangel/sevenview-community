export function releaseImage(image: CanvasImageSource): void {
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    image.close()
  }
}

export function releasePreviewUrl(previewUrl: string): void {
  URL.revokeObjectURL(previewUrl)
}
