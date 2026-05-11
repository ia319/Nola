function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

function resolvePathSegments(path: string): string[] | null {
  if (!path) return null

  const segments = path.split('.')
  if (segments.some((segment) => !segment || FORBIDDEN_PATH_SEGMENTS.has(segment))) {
    return null
  }

  return segments
}

export function getValueByPath(source: unknown, path: string): unknown {
  const segments = resolvePathSegments(path)
  if (!segments) return undefined

  let current: unknown = source

  for (const segment of segments) {
    if (!isRecord(current)) return undefined
    current = current[segment]
  }

  return current
}

export function setValueByPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const segments = resolvePathSegments(path)
  if (!segments) return

  let current = target

  for (const [index, segment] of segments.entries()) {
    if (index === segments.length - 1) {
      current[segment] = value
      return
    }

    const existing = current[segment]
    if (!isRecord(existing)) {
      current[segment] = {}
    }

    current = current[segment] as Record<string, unknown>
  }
}
