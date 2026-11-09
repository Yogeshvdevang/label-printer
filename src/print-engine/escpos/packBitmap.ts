import { packMonoBitmap, packFromRgba as packFromRgbaCore, type MonoBitmap, type BitPolarity } from '../shared/monoBitmap.js'

export type { MonoBitmap }

/** ESC/POS's GS v 0 raster spec defines bit=1 as "print this dot" (black).
 *  Unverified on this specific printer's ESC/POS engine — flip after the
 *  first physical receipt test print if it comes out inverted, same as
 *  was needed for TSPL (see tspl/packBitmap.ts). */
export const BIT_POLARITY: BitPolarity = 'blackIs1'

export function packMonochromeBitmap(
  widthDots: number,
  heightDots: number,
  isInk: (x: number, y: number) => boolean
): MonoBitmap {
  return packMonoBitmap(widthDots, heightDots, isInk, BIT_POLARITY)
}

export function packFromRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  widthDots: number,
  heightDots: number,
  threshold = 128
): MonoBitmap {
  return packFromRgbaCore(rgba, widthDots, heightDots, BIT_POLARITY, threshold)
}
