function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Resolve a dot-path value from a nested object.
 *
 * Returns `undefined` when any segment is missing.
 */
export function getValueByPath(source: unknown, path: string): unknown {
  if (!path) return undefined

  const segments = path.split('.')
  let current: unknown = source

  for (const segment of segments) {
    if (!isRecord(current)) return undefined
    current = current[segment]
  }

  return current
}

/**
 * Write a value into a nested object using a dot-path, creating objects as needed.
 */
export function setValueByPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const segments = path.split('.')
  const [head, ...rest] = segments
  if (!head) return

  if (rest.length === 0) {
    target[head] = value
    return
  }

  const existing = target[head]
  if (!isRecord(existing)) {
    target[head] = {}
  }

  setValueByPath(target[head] as Record<string, unknown>, rest.join('.'), value)
}
