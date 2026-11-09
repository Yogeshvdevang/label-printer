import { writeFile, unlink, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { runPowerShellScript } from './runPowerShell.js'

interface RawPrintResult {
  ok: boolean
  bytesSent?: number
  bytesWritten?: number
  error?: string
}

/**
 * Sends a raw byte buffer (e.g. a TSPL2 job) to a Windows printer queue,
 * bypassing driver text/RAW-datatype handling via the WritePrinter P/Invoke
 * helper in resources/raw-print.ps1. Confirmed working against the
 * "4BARCODE-RAW" queue (Generic / Text Only driver, USB001 port).
 */
export async function sendRawBytesToPrinter(
  printerName: string,
  bytes: Buffer,
  scriptPath: string
): Promise<RawPrintResult> {
  const dir = await mkdtemp(join(tmpdir(), 'label-printer-'))
  const jobPath = join(dir, `${randomUUID()}.bin`)

  try {
    await writeFile(jobPath, bytes)
    const output = await runPowerShellScript(scriptPath, ['-PrinterName', printerName, '-FilePath', jobPath])
    const result = JSON.parse(output) as RawPrintResult
    return result
  } finally {
    await unlink(jobPath).catch(() => {})
  }
}
