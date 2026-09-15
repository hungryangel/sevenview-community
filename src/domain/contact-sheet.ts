type ContactSheetInput = {
  readonly width: number
  readonly height: number
  readonly margin: number
  readonly gap: number
  readonly labelHeight: number
}

export type ContactSheetTile = {
  readonly index: number
  readonly row: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly labelY: number
  readonly right: number
  readonly bottom: number
}

// 줄별 칸 수(rows)를 받아 배치한다. 기본 [4, 3]은 성형외과 7뷰, 치과 6뷰는 [3, 3].
// 칸 크기는 가장 긴 줄과 줄 수로 정해지고, 짧은 줄은 가운데 정렬한다.
export function buildContactSheetLayout(
  input: ContactSheetInput,
  rows: readonly number[] = [4, 3],
): readonly ContactSheetTile[] {
  const maxColumns = Math.max(1, ...rows)
  const rowCount = Math.max(1, rows.length)
  const availableWidth = input.width - input.margin * 2 - input.gap * (maxColumns - 1)
  const availableRowHeight =
    (input.height - input.margin * 2 - input.gap * (rowCount - 1)) / rowCount
  const widthByHeight = ((availableRowHeight - input.labelHeight) * 4) / 5
  const tileWidth = Math.min(availableWidth / maxColumns, widthByHeight)
  const tileHeight = (tileWidth * 5) / 4
  const totalTileHeight = tileHeight + input.labelHeight
  const groupHeight = totalTileHeight * rowCount + input.gap * (rowCount - 1)
  const startY = (input.height - groupHeight) / 2

  const tiles: ContactSheetTile[] = []
  let index = 0
  rows.forEach((count, row) => {
    const rowWidth = count * tileWidth + (count - 1) * input.gap
    const startX = (input.width - rowWidth) / 2
    for (let position = 0; position < count; position += 1) {
      const x = startX + position * (tileWidth + input.gap)
      const y = startY + row * (totalTileHeight + input.gap)
      const labelY = y + tileHeight
      tiles.push({
        index,
        row,
        x,
        y,
        width: tileWidth,
        height: tileHeight,
        labelY,
        right: x + tileWidth,
        bottom: labelY + input.labelHeight,
      })
      index += 1
    }
  })
  return tiles
}
