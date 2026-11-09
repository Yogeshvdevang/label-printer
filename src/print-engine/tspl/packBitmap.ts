import { packMonoBitmap, packFromRgba as packFromRgbaCore, type MonoBitmap, type BitPolarity } from '../shared/monoBitmap.js'

export type { MonoBitmap }

/** Whether an "ink" (printed/black) pixel is encoded as bit 1 or bit 0 for
 *  TSPL2 BITMAP on this printer. Confirmed by physical test print on
 *  2026-08-21: blackIs0 is correct for the 4BARCODE 4B-2034PA. */
export const BIT_POLARITY: BitPolarity = 'blackIs0'

/**
 * @param isInk Returns true if the pixel at (x, y) should be printed (black).
 */
export function packMonochromeBitmap(
  widthDots: number,
  heightDots: number,
  isInk: (x: number, y: number) => boolean
): MonoBitmap {
  return packMonoBitmap(widthDots, heightDots, isInk, BIT_POLARITY)
}

/** Threshold RGBA pixel data (e.g. from a canvas ImageData) into a MonoBitmap. */
export function packFromRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  widthDots: number,
  heightDots: number,
  threshold = 128
): MonoBitmap {
  return packFromRgbaCore(rgba, widthDots, heightDots, BIT_POLARITY, threshold)
}
