import type { AxiosRequestConfig, Method } from 'axios'

import apiClient from '@/shared/lib/api-client'

export type QueryFetcherOptions<TParams = unknown, TData = unknown> = {
  path: string
  method?: Method
  params?: TParams
  data?: TData
  signal?: AbortSignal
} & Omit<AxiosRequestConfig<TData>, 'data' | 'method' | 'params' | 'signal' | 'url'>

export async function queryFetcher<TResponse, TParams = unknown, TData = unknown>({
  path,
  method = 'GET',
  params,
  data,
  signal,
  ...config
}: QueryFetcherOptions<TParams, TData>): Promise<TResponse> {
  const response = await apiClient.request<TResponse>({
    url: path,
    method,
    params,
    data,
    signal,
    ...config,
  })

  return response.data
}
