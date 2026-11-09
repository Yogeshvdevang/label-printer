import { buildTsplJob, DEFAULT_PROFILE } from './tspl/buildCommands.js'
import { packMonochromeBitmap } from './tspl/packBitmap.js'
import { sendRawBytesToPrinter } from './windows/rawPrint.js'
import { listPrinters, type PrinterInfo } from './windows/listPrinters.js'
import { resolveRawPrintScript } from './windows/resolveScript.js'

export { listPrinters, type PrinterInfo }
export { resolveRawPrintScript }
export { printRasterizedPage, type PrintPageParams } from './printPage.js'

/**
 * Sends a fixed test pattern (border + filled corner + diagonal) to the given
 * printer queue. Used both as a manual "verify hardware" tool and to visually
 * calibrate DEFAULT_DOTS_PER_MM / BIT_POLARITY against the physical printout.
 */
export async function sendTestPage(printerName: string, widthMm = 40, heightMm = 30, dotsPerMm = 8): Promise<void> {
  const widthDots = Math.round(widthMm * dotsPerMm)
  const heightDots = Math.round(heightMm * dotsPerMm)
  const border = Math.max(2, Math.round(dotsPerMm)) // ~1mm border

  const bitmap = packMonochromeBitmap(widthDots, heightDots, (x, y) => {
    const onBorder = x < border || y < border || x >= widthDots - border || y >= heightDots - border
    const inTopLeftBlock = x < widthDots / 4 && y < heightDots / 4
    const onDiagonal = Math.abs(x / widthDots - y / heightDots) < 0.02
    return onBorder || inTopLeftBlock || onDiagonal
  })

  const job = buildTsplJob({
    widthMm,
    heightMm,
    bitmap,
    profile: DEFAULT_PROFILE
  })

  const result = await sendRawBytesToPrinter(printerName, job, resolveRawPrintScript())
  if (!result.ok) {
    throw new Error(result.error ?? 'Unknown print failure')
  }
}
