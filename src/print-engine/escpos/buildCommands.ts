import type { MonoBitmap } from './packBitmap.js'

const ESC = 0x1b
const GS = 0x1d

/**
 * Builds an ESC/POS job that initializes the printer, prints one raster
 * image (GS v 0) built from the packed bitmap, then feeds a few lines so
 * the strip clears the tear bar. Requires the printer to be physically
 * switched to ESC (receipt) mode — see docs/PRINTER-SETUP.md.
 */
export function buildEscPosJob(params: { bitmap: MonoBitmap; feedLinesAfter?: number }): Buffer {
  const { bitmap, feedLinesAfter = 3 } = params

  const init = Buffer.from([ESC, 0x40]) // ESC @ : initialize printer

  const xL = bitmap.widthBytes & 0xff
  const xH = (bitmap.widthBytes >> 8) & 0xff
  const yL = bitmap.heightDots & 0xff
  const yH = (bitmap.heightDots >> 8) & 0xff
  const rasterHeader = Buffer.from([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]) // GS v 0 m xL xH yL yH

  const feed = Buffer.from([ESC, 0x64, feedLinesAfter]) // ESC d n : print and feed n lines

  return Buffer.concat([init, rasterHeader, bitmap.data, feed])
}
