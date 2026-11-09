import { execFile } from 'node:child_process'

/**
 * Runs a PowerShell script file with the given positional/named args.
 * Uses execFile with an argument array (no shell), so caller-provided
 * strings (printer names, paths) are never interpolated into a command string.
 */
export function runPowerShellScript(scriptPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args],
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`PowerShell script failed: ${stderr || error.message}`))
          return
        }
        resolve(stdout.trim())
      }
    )
  })
}

export function runPowerShellCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`PowerShell command failed: ${stderr || error.message}`))
          return
        }
        resolve(stdout.trim())
      }
    )
  })
}
