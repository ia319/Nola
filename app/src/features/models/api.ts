import apiClient from '@/shared/lib/api-client'

import type {
  ActiveModelDownloadsResponse,
  ModelCancelResponse,
  ModelDeleteResponse,
  ModelDetailResponse,
  ModelDownloadStartedResponse,
  ModelListResponse,
  ModelSelectResponse,
  ModelSettingsResponse,
  ModelSettingsUpdateRequest,
} from './types'

const BASE = '/api/models'

export async function listModels(signal?: AbortSignal): Promise<ModelListResponse> {
  const { data } = await apiClient.get<ModelListResponse>(BASE, { signal })
  return data
}

export async function listActiveModelDownloads(
  signal?: AbortSignal,
): Promise<ActiveModelDownloadsResponse> {
  const { data } = await apiClient.get<ActiveModelDownloadsResponse>(`${BASE}/downloads`, {
    signal,
  })
  return data
}

export async function getModelDetail(
  modelId: string,
  signal?: AbortSignal,
): Promise<ModelDetailResponse> {
  const { data } = await apiClient.get<ModelDetailResponse>(`${BASE}/${modelId}`, { signal })
  return data
}

export async function startDownload(modelId: string): Promise<ModelDownloadStartedResponse> {
  const { data } = await apiClient.post<ModelDownloadStartedResponse>(`${BASE}/${modelId}/download`)
  return data
}

export async function cancelDownload(modelId: string): Promise<ModelCancelResponse> {
  const { data } = await apiClient.post<ModelCancelResponse>(`${BASE}/${modelId}/cancel`)
  return data
}

export async function deleteModel(modelId: string): Promise<ModelDeleteResponse> {
  const { data } = await apiClient.delete<ModelDeleteResponse>(`${BASE}/${modelId}`)
  return data
}

export async function selectModel(modelId: string): Promise<ModelSelectResponse> {
  const { data } = await apiClient.post<ModelSelectResponse>(`${BASE}/${modelId}/select`)
  return data
}

export async function getModelSettings(signal?: AbortSignal): Promise<ModelSettingsResponse> {
  const { data } = await apiClient.get<ModelSettingsResponse>(`${BASE}/settings`, { signal })
  return data
}

export async function patchModelSettings(
  payload: ModelSettingsUpdateRequest,
): Promise<ModelSettingsResponse> {
  const { data } = await apiClient.patch<ModelSettingsResponse>(`${BASE}/settings`, payload)
  return data
}
