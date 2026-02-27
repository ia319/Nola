import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import env from '@/config/env'
import logger from '@/config/logger'
import { formatApiError, type ApiError } from '@/shared/types'

const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30_000,
  // Omit global Content-Type to let Axios auto-detect:
  // - JSON requests  -> application/json
  // - FormData       -> multipart/form-data with boundary
})

// Request interceptor: log outgoing requests, extend for auth later.
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  logger.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`)
  return config
})

// Response interceptor: parse ApiError and log failures.
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    const status = error.response?.status
    let detail: string
    try {
      detail = error.response?.data ? formatApiError(error.response.data) : error.message
    } catch {
      // Non-conforming response shape (e.g. HTML from proxy).
      detail = error.message
    }

    logger.error(`[API] ${status ?? 'NETWORK'} ${detail}`)

    // TODO(F8): Integrate toast notification [2026-02-26]

    return Promise.reject(error)
  },
)

export default apiClient
