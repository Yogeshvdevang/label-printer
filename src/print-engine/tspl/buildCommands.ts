import type { MonoBitmap } from './packBitmap.js'

export interface PrinterProfile {
  /** Gap between labels, in mm (0 for continuous/black-mark stock — tune per roll). */
  gapMm: number
  gapOffsetMm: number
  /** TSPL2 DIRECTION: 0 or 1, controls feed direction / print origin corner. */
  direction: 0 | 1
  referenceX: number
  referenceY: number
}

export const DEFAULT_PROFILE: PrinterProfile = {
  gapMm: 2,
  gapOffsetMm: 0,
  direction: 0,
  referenceX: 0,
  referenceY: 0
}

/**
 * Builds a full TSPL2 print job: SIZE/GAP/DIRECTION/REFERENCE/CLS/BITMAP/PRINT.
 * Returned as a Buffer (never a string) so bitmap bytes >= 0x80 survive intact.
 */
export function buildTsplJob(params: {
  widthMm: number
  heightMm: number
  bitmap: MonoBitmap
  profile?: PrinterProfile
  copies?: number
}): Buffer {
  const profile = params.profile ?? DEFAULT_PROFILE
  const copies = params.copies ?? 1

  const header =
    `SIZE ${params.widthMm} mm,${params.heightMm} mm\r\n` +
    `GAP ${profile.gapMm} mm,${profile.gapOffsetMm} mm\r\n` +
    `DIRECTION ${profile.direction}\r\n` +
    `REFERENCE ${profile.referenceX},${profile.referenceY}\r\n` +
    `CLS\r\n` +
    `BITMAP 0,0,${params.bitmap.widthBytes},${params.bitmap.heightDots},0,`

  const footer = `\r\nPRINT 1,${copies}\r\n`

  return Buffer.concat([
    Buffer.from(header, 'ascii'),
    params.bitmap.data,
    Buffer.from(footer, 'ascii')
  ])
}
