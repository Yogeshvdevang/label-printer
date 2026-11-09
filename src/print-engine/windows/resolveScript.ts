import { app } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

/** Resolves resources/raw-print.ps1 in both `electron-vite dev` and a packaged app. */
export function resolveRawPrintScript(): string {
  const candidates = [
    join(process.cwd(), 'resources', 'raw-print.ps1'), // dev
    join(process.resourcesPath ?? '', 'raw-print.ps1'), // packaged (electron-builder extraResources)
    join(app.getAppPath(), 'resources', 'raw-print.ps1')
  ]
  const found = candidates.find((p) => existsSync(p))
  if (!found) {
    throw new Error(`raw-print.ps1 not found. Checked: ${candidates.join(', ')}`)
  }
  return found
}
