import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'node:path'
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import { listPrinters, sendTestPage, printRasterizedPage, resolveRawPrintScript } from '../print-engine/index.js'
import type { PrintPageParams } from '../print-engine/printPage.js'

function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('printers:list', async () => {
  return listPrinters()
})

ipcMain.handle('printers:sendTest', async (_event, printerName: string) => {
  await sendTestPage(printerName)
  return { ok: true }
})

ipcMain.handle('printers:printPage', async (_event, params: PrintPageParams) => {
  await printRasterizedPage(
    { ...params, rgba: new Uint8Array(params.rgba) },
    resolveRawPrintScript()
  )
  return { ok: true }
})

function documentsDir(): string {
  return join(app.getPath('userData'), 'documents')
}

ipcMain.handle('documents:list', async () => {
  await mkdir(documentsDir(), { recursive: true })
  const files = await readdir(documentsDir())
  return files.filter((f) => f.endsWith('.json'))
})

ipcMain.handle('documents:load', async (_event, filename: string) => {
  const text = await readFile(join(documentsDir(), filename), 'utf-8')
  return JSON.parse(text)
})

ipcMain.handle('documents:save', async (_event, filename: string, data: unknown) => {
  await mkdir(documentsDir(), { recursive: true })
  await writeFile(join(documentsDir(), filename), JSON.stringify(data, null, 2), 'utf-8')
  return { ok: true }
})

ipcMain.handle('documents:delete', async (_event, filename: string) => {
  await unlink(join(documentsDir(), filename)).catch(() => {})
  return { ok: true }
})

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
