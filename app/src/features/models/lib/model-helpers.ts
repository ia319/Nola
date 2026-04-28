import type { TFunction } from 'i18next'

import type { DownloadState } from '@/features/models/hooks/useModelDownload'
import type { ModelStatus } from '@/features/models/types'

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

export interface ModelActionState {
  status: ModelStatus
  hasLiveDownload: boolean
  isDownloading: boolean
  isDownloaded: boolean
  isPartialDownload: boolean
  canDownload: boolean
  canDelete: boolean
}

type ModelAvailabilityLike = {
  status: ModelStatus
}

export function getModelActionState<T extends ModelAvailabilityLike>(
  model: T,
  downloadState?: DownloadState,
): ModelActionState {
  const hasLiveDownload = downloadState != null
  const status = downloadState?.status === 'downloading' ? 'downloading' : model.status
  const isDownloading = downloadState?.status === 'downloading'
  const isDownloaded = status === 'downloaded' && !hasLiveDownload
  const isPartialDownload = status === 'partial_download' && !hasLiveDownload
  const canDownload = !hasLiveDownload && !isDownloaded
  const canDelete = !hasLiveDownload && (isDownloaded || isPartialDownload)

  return {
    status,
    hasLiveDownload,
    isDownloading,
    isDownloaded,
    isPartialDownload,
    canDownload,
    canDelete,
  }
}

export function splitModelLanguages(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

type ModelDescriptionLike = {
  description: string
  description_key: string
}

export function resolveModelDescription<T extends ModelDescriptionLike>(
  t: TFunction,
  model: T,
): string {
  const fallback = model.description.trim()
  const key = model.description_key.trim()

  if (!key) {
    return fallback
  }

  const translated = t(key, { defaultValue: fallback }).trim()
  if (translated && translated != key) {
    return translated
  }

  return fallback
}
