/** Windows BMP with white-composited BGRA pixels, stored bottom-up. */
export function encodeBmp(rgba: Uint8Array, width: number, height: number): Buffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 ||
      width * height > 20_000_000 || rgba.length !== width * height * 4) throw new Error('Invalid print image dimensions.')
  const bmp = Buffer.alloc(54 + width * height * 4)
  bmp.write('BM'); bmp.writeUInt32LE(bmp.length, 2); bmp.writeUInt32LE(54, 10)
  bmp.writeUInt32LE(40, 14); bmp.writeInt32LE(width, 18); bmp.writeInt32LE(height, 22)
  bmp.writeUInt16LE(1, 26); bmp.writeUInt16LE(32, 28)
  bmp.writeUInt32LE(width * height * 4, 34)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const src = (y * width + x) * 4
    const dst = 54 + ((height - 1 - y) * width + x) * 4
    const alpha = rgba[src + 3] / 255
    for (let channel = 0; channel < 3; channel++) bmp[dst + channel] = Math.round(rgba[src + 2 - channel] * alpha + 255 * (1 - alpha))
    bmp[dst + 3] = 255
  }
  return bmp
}
