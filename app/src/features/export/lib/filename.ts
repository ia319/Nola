import type { ExportFormat } from '@/shared/types'

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g

function sanitizeStem(value: string): string {
  const normalized = Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0)
      if (code >= 0 && code <= 31) {
        return '_'
      }
      return char
    })
    .join('')

  return normalized
    .replace(INVALID_FILENAME_CHARS, '_')
    .trim()
    .replace(/^\.+|\.+$/g, '')
}

function extractStem(value: string): string {
  const stripped = value.trim()
  if (!stripped) {
    return ''
  }
  const leaf = stripped.replace(/\\/g, '/').split('/').pop() ?? ''
  const dotIndex = leaf.lastIndexOf('.')
  const stem = dotIndex > 0 ? leaf.slice(0, dotIndex) : leaf
  return sanitizeStem(stem)
}

export interface BuildSingleExportFilenameParams {
  format: ExportFormat
  taskId: string
  taskFilename?: string | null
  customFilename?: string | null
}

export interface BuildExportFilenameParams {
  format: ExportFormat
  fallbackId: string
  sourceName?: string | null
  customFilename?: string | null
}

/** Build a single-export filename from the same priority order as the backend. */
export function buildExportFilename({
  format,
  fallbackId,
  sourceName,
  customFilename,
}: BuildExportFilenameParams): string {
  const customStem = customFilename ? extractStem(customFilename) : ''
  const sourceStem = sourceName ? extractStem(sourceName) : ''
  const fallbackStem = sanitizeStem(fallbackId) || 'export'
  const stem = customStem || sourceStem || fallbackStem
  return `${stem}.${format}`
}

/** Keep task export filename fallback stable for existing callers. */
export function buildSingleExportFilename({
  format,
  taskId,
  taskFilename,
  customFilename,
}: BuildSingleExportFilenameParams): string {
  return buildExportFilename({
    customFilename,
    fallbackId: taskId,
    format,
    sourceName: taskFilename,
  })
}
