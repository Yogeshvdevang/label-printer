import { buildTsplJob, DEFAULT_PROFILE, type PrinterProfile } from './tspl/buildCommands.js'
import { packFromRgba as packFromRgbaTspl } from './tspl/packBitmap.js'
import { buildEscPosJob } from './escpos/buildCommands.js'
import { packFromRgba as packFromRgbaEscPos } from './escpos/packBitmap.js'
import { sendRawBytesToPrinter } from './windows/rawPrint.js'

export interface PrintPageParams {
  kind: 'label' | 'receipt'
  widthMm: number
  heightMm: number
  widthDots: number
  heightDots: number
  /** RGBA pixel bytes from the renderer's rasterized canvas, widthDots x heightDots. */
  rgba: Uint8Array
  printerName: string
  profile?: PrinterProfile
}

export async function printRasterizedPage(params: PrintPageParams, scriptPath: string): Promise<void> {
  let job: Buffer

  if (params.kind === 'label') {
    const bitmap = packFromRgbaTspl(params.rgba, params.widthDots, params.heightDots)
    job = buildTsplJob({
      widthMm: params.widthMm,
      heightMm: params.heightMm,
      bitmap,
      profile: params.profile ?? DEFAULT_PROFILE
    })
  } else {
    const bitmap = packFromRgbaEscPos(params.rgba, params.widthDots, params.heightDots)
    job = buildEscPosJob({ bitmap })
  }

  const result = await sendRawBytesToPrinter(params.printerName, job, scriptPath)
  if (!result.ok) {
    throw new Error(result.error ?? 'Unknown print failure')
  }
}
