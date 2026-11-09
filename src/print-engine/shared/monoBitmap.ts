/**
 * Generic monochrome raster packer shared by both command languages
 * (TSPL2 BITMAP and ESC/POS GS v 0 use the same MSB-first, byte-padded-row
 * format — they can disagree on which bit value means "ink" though, so
 * polarity is passed in explicitly rather than assumed here).
 */

export interface MonoBitmap {
  widthDots: number
  heightDots: number
  widthBytes: number
  data: Buffer
}

export type BitPolarity = 'blackIs1' | 'blackIs0'

/**
 * @param isInk Returns true if the pixel at (x, y) should be printed (black).
 */
export function packMonoBitmap(
  widthDots: number,
  heightDots: number,
  isInk: (x: number, y: number) => boolean,
  polarity: BitPolarity
): MonoBitmap {
  const widthBytes = Math.ceil(widthDots / 8)
  const inkBit = polarity === 'blackIs1' ? 1 : 0
  const backgroundBit = inkBit === 1 ? 0 : 1

  // Pre-fill every row (including the padding bits beyond widthDots up to
  // the byte boundary) with the background bit, so padding reads as
  // "background" under either polarity rather than always literal 0.
  const data = Buffer.alloc(widthBytes * heightDots, backgroundBit === 1 ? 0xff : 0x00)

  for (let y = 0; y < heightDots; y++) {
    const rowOffset = y * widthBytes
    for (let x = 0; x < widthDots; x++) {
      const byteIndex = rowOffset + (x >> 3)
      const bitIndex = 7 - (x & 7) // MSB-first
      const bitValue = isInk(x, y) ? inkBit : backgroundBit
      if (bitValue === 1) {
        data[byteIndex] |= 1 << bitIndex
      } else {
        data[byteIndex] &= ~(1 << bitIndex)
      }
    }
  }

  return { widthDots, heightDots, widthBytes, data }
}

/** Threshold RGBA pixel data (e.g. from a canvas ImageData) into a MonoBitmap. */
export function packFromRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  widthDots: number,
  heightDots: number,
  polarity: BitPolarity,
  threshold = 128
): MonoBitmap {
  return packMonoBitmap(
    widthDots,
    heightDots,
    (x, y) => {
      const i = (y * widthDots + x) * 4
      const r = rgba[i]
      const g = rgba[i + 1]
      const b = rgba[i + 2]
      const alpha = rgba[i + 3]
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b
      // Treat transparent pixels as background (not ink).
      return alpha > 0 && luminance < threshold
    },
    polarity
  )
}
