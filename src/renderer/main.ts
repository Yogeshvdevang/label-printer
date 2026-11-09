import { initDesigner } from './designer/ui.js'

interface PrinterInfo {
  Name: string
  DriverName: string
  PortName: string
}

interface PrintPageParams {
  kind: 'label' | 'receipt'
  widthMm: number
  heightMm: number
  widthDots: number
  heightDots: number
  rgba: number[]
  printerName: string
}

interface Api {
  listPrinters: () => Promise<PrinterInfo[]>
  sendTestPage: (printerName: string) => Promise<{ ok: boolean }>
  printPage: (params: PrintPageParams) => Promise<{ ok: boolean }>
  listDocuments: () => Promise<string[]>
  loadDocument: (filename: string) => Promise<unknown>
  saveDocument: (filename: string, data: unknown) => Promise<{ ok: boolean }>
  deleteDocument: (filename: string) => Promise<{ ok: boolean }>
}

declare global {
  interface Window {
    api: Api
  }
}

initDesigner()
