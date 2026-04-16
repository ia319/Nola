export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'

  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const precision = Number.isFinite(decimals) ? Math.max(0, Math.trunc(decimals)) : 1
  const rawIndex = Math.floor(Math.log(bytes) / Math.log(k))
  const unitIndex = Math.min(Math.max(rawIndex, 0), units.length - 1)
  const value = bytes / k ** unitIndex
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

export function formatMegabytes(bytes: number, decimals = 1): string {
  const precision = Number.isFinite(decimals) ? Math.max(0, Math.trunc(decimals)) : 1
  if (!Number.isFinite(bytes) || bytes <= 0) return `0.${'0'.repeat(precision)} MB`

  return `${(bytes / 1024 ** 2).toFixed(precision)} MB`
}

export function formatSpeed(bps: number): string {
  if (bps <= 0) return '0 B/s'
  return `${formatBytes(bps)}/s`
}

export function formatMegabytesPerSecond(bps: number, decimals = 1): string {
  return `${formatMegabytes(bps, decimals)}/s`
}

export function formatPercent(percent: number): string {
  return `${percent.toFixed(1)}%`
}

/**
 * Sort order: configured first, then accuracy descending, then size ascending.
 */
export function sortModelsForDisplay<
  T extends { is_configured: boolean; accuracy_rank: number; size_bytes: number },
>(models: readonly T[]): T[] {
  return [...models].sort((a, b) => {
    if (a.is_configured !== b.is_configured) return a.is_configured ? -1 : 1
    if (a.accuracy_rank !== b.accuracy_rank) return b.accuracy_rank - a.accuracy_rank
    return a.size_bytes - b.size_bytes
  })
}
