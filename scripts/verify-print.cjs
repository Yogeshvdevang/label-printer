const { app, ipcMain } = require('electron')

const handlers = {}
const originalHandle = ipcMain.handle.bind(ipcMain)
ipcMain.handle = (channel, fn) => {
  handlers[channel] = fn
  return originalHandle(channel, fn)
}

app.whenReady().then(async () => {
  require('../out/main/main.js') // registers the real IPC handlers + opens the real main window

  try {
    const printers = await handlers['printers:list']()
    console.log('PRINTERS:', JSON.stringify(printers))

    const result = await handlers['printers:sendTest']({}, '4BARCODE 4B-2034PA')
    console.log('PRINT_RESULT:', JSON.stringify(result))
  } catch (err) {
    console.error('PRINT_RESULT: FAIL', err && err.stack ? err.stack : err)
    process.exitCode = 1
  } finally {
    setTimeout(() => app.quit(), 500)
  }
})
