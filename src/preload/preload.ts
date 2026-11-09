import { contextBridge, ipcRenderer } from 'electron'
import type { PrinterInfo } from '../print-engine/index.js'
import type { PrintPageParams } from '../print-engine/printPage.js'

const api = {
  listPrinters: (): Promise<PrinterInfo[]> => ipcRenderer.invoke('printers:list'),
  sendTestPage: (printerName: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('printers:sendTest', printerName),
  printPage: (params: PrintPageParams): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('printers:printPage', params),

  listDocuments: (): Promise<string[]> => ipcRenderer.invoke('documents:list'),
  loadDocument: (filename: string): Promise<unknown> => ipcRenderer.invoke('documents:load', filename),
  saveDocument: (filename: string, data: unknown): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('documents:save', filename, data),
  deleteDocument: (filename: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('documents:delete', filename)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
