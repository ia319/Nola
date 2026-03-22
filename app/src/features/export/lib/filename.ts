import type { ExportFormat } from '@/shared/types'

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]+/g

function removeControlChars(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
}

function sanitizeStem(value: string): string {
  return removeControlChars(value)
    .replace(INVALID_FILENAME_CHARS, '_')
    .trim()
    .replace(/^\.+|\.+$/g, '')
}

function extractStem(value: string): string {
  const leaf = value.replace(/\\/g, '/').split('/').pop() ?? ''
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

/** Keep frontend filename fallback consistent with backend single-export semantics. */
export function buildSingleExportFilename({
  format,
  taskId,
  taskFilename,
  customFilename,
}: BuildSingleExportFilenameParams): string {
  const customStem = customFilename ? extractStem(customFilename) : ''
  const taskStem = taskFilename ? extractStem(taskFilename) : ''
  const fallbackStem = sanitizeStem(`task-${taskId}`) || 'task-export'
  const stem = customStem || taskStem || fallbackStem
  return `${stem}.${format}`
}
