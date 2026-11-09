const PLACEHOLDER_RE = /\{\{\s*([\w.]+)\s*\}\}/g

function getPath(data: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) return (acc as Record<string, unknown>)[key]
    return undefined
  }, data)
}

/** Replaces every {{field}} or {{a.b}} token in str with the matching value from data. */
export function substitute(str: string, data: Record<string, unknown>): string {
  return str.replace(PLACEHOLDER_RE, (match, path: string) => {
    const value = getPath(data, path)
    return value === undefined || value === null ? match : String(value)
  })
}

/** Returns every distinct {{field}} path referenced in str. */
export function extractFields(str: string): string[] {
  const fields = new Set<string>()
  for (const match of str.matchAll(PLACEHOLDER_RE)) fields.add(match[1])
  return [...fields]
}
