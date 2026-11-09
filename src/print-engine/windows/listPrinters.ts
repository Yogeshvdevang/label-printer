import { runPowerShellCommand } from './runPowerShell.js'

export interface PrinterInfo {
  Name: string
  DriverName: string
  PortName: string
  PrinterStatus: string
}

export async function listPrinters(): Promise<PrinterInfo[]> {
  const output = await runPowerShellCommand(
    'Get-Printer | Select-Object Name,DriverName,PortName,PrinterStatus | ConvertTo-Json -Compress'
  )
  if (!output) return []
  const parsed = JSON.parse(output)
  return Array.isArray(parsed) ? parsed : [parsed]
}
