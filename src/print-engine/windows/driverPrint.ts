import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import type { PrintPageParams } from '../printPage.js'
import { encodeBmp } from './bitmapFile.js'
import { runPowerShellScript } from './runPowerShell.js'
import { resolveRawPrintScript } from './resolveScript.js'

/** Use the same Windows GDI PrintDocument path verified on the Josh. */
export async function printWithWindowsDriver(params: PrintPageParams): Promise<void> {
  const { widthMm, heightMm, widthDots, heightDots, rgba, printerName } = params
  if (![widthMm, heightMm].every(n => Number.isFinite(n) && n >= 5 && n <= 2000)) {
    throw new Error('Invalid label dimensions.')
  }
  const bitmap = encodeBmp(rgba, widthDots, heightDots)
  const dir = await mkdtemp(join(tmpdir(), 'label-driver-'))
  try {
    const file = join(dir, 'canvas.bmp')
    await writeFile(file, bitmap)
    const script = join(dirname(resolveRawPrintScript()), 'driver-print.ps1')
    const output = await runPowerShellScript(script, [
      '-PrinterName', printerName, '-FilePath', file,
      '-WidthMm', String(widthMm), '-HeightMm', String(heightMm)
    ])
    if (JSON.parse(output).ok !== true) throw new Error('Windows rejected the print job.')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
