export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / k ** i
  return `${value.toFixed(decimals)} ${units[i]}`
}

export function formatSpeed(bps: number): string {
  if (bps <= 0) return '0 B/s'
  return `${formatBytes(bps)}/s`
}

export function formatPercent(percent: number): string {
  return `${percent.toFixed(1)}%`
}

/**
 * Sort order: configured first, then accuracy descending, then size ascending.
 */
export function sortModelsForDisplay<
  T extends { is_configured: boolean; accuracy_rank: number; size_bytes: number },
>(models: T[]): T[] {
  return [...models].sort((a, b) => {
    if (a.is_configured !== b.is_configured) return a.is_configured ? -1 : 1
    if (a.accuracy_rank !== b.accuracy_rank) return b.accuracy_rank - a.accuracy_rank
    return a.size_bytes - b.size_bytes
  })
}
