const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * Format a byte count into a human-readable string.
 *
 * Uses base-1024 units (B / KB / MB / GB / TB) with one decimal place
 * for values >= 1 KB. Returns `"0 B"` for zero.
 *
 * @param bytes - Non-negative byte count.
 * @returns Formatted string, e.g. `"1.5 GB"`.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes === 0) return '0 B'

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** exponent
  const unit = UNITS[exponent]

  // Show whole numbers for bytes, one decimal otherwise
  return exponent === 0 ? `${value} ${unit}` : `${value.toFixed(1)} ${unit}`
}
