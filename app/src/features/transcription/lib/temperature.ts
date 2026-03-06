export type TemperatureInputValue = number | number[] | null | undefined

export type TemperatureParseErrorCode =
  | 'emptySegment'
  | 'invalidCharacter'
  | 'invalidNumber'
  | 'negativeNotAllowed'

export type TemperatureParseResult =
  | { kind: 'empty' }
  | { kind: 'success'; values: number[]; canonical: string }
  | { kind: 'error'; code: TemperatureParseErrorCode }

const TEMPERATURE_ALLOWED_CHARS_RE = /^[\d\s,.-]*$/
const TEMPERATURE_TOKEN_RE = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/

/**
 * Normalize committed temperature values into the stable UI string form.
 *
 * @param values - Parsed temperature values that are already semantically valid.
 * @returns A comma-space separated string suitable for field display.
 */
export function formatTemperatureValues(values: number[]): string {
  return values.map((value) => String(value)).join(', ')
}

/**
 * Bridge stored option state back into the editable draft representation.
 *
 * @param value - The persisted temperature option value from form state.
 * @returns A draft string for the input, or an empty string when unset.
 */
export function serializeTemperatureValue(value: TemperatureInputValue): string {
  if (Array.isArray(value)) return formatTemperatureValues(value)
  if (typeof value === 'number') return String(value)
  return ''
}

/**
 * Convert free-form temperature input into a validated semantic value.
 *
 * The parser only auto-normalizes inputs whose intent is unambiguous,
 * such as trailing commas or decimals like `0.`. Ambiguous drafts are
 * reported as errors so the UI can preserve the raw text for correction.
 *
 * @param raw - User-entered draft text from the temperature field.
 * @returns An empty, success, or error result for the caller to handle explicitly.
 */
export function parseTemperatureDraft(raw: string): TemperatureParseResult {
  const trimmed = raw.trim()
  if (trimmed === '') return { kind: 'empty' }

  if (!TEMPERATURE_ALLOWED_CHARS_RE.test(trimmed)) {
    return { kind: 'error', code: 'invalidCharacter' }
  }

  const segments = raw.split(',').map((segment) => segment.trim())
  const hasTrailingSeparator = segments.at(-1) === ''
  const tokens = hasTrailingSeparator ? segments.slice(0, -1) : segments

  if (tokens.length === 0 || tokens.some((token) => token === '')) {
    return { kind: 'error', code: 'emptySegment' }
  }

  const values: number[] = []

  for (const token of tokens) {
    if (!TEMPERATURE_TOKEN_RE.test(token)) {
      return { kind: 'error', code: 'invalidNumber' }
    }

    const value = Number(token)
    if (!Number.isFinite(value)) {
      return { kind: 'error', code: 'invalidNumber' }
    }
    if (value < 0) {
      return { kind: 'error', code: 'negativeNotAllowed' }
    }

    values.push(value)
  }

  return {
    kind: 'success',
    values,
    canonical: formatTemperatureValues(values),
  }
}
