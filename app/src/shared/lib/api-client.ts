import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { getActiveApiBaseUrl } from '@/config/connection/runtime'
import logger from '@/config/logger'
import { formatApiError, getApiErrorCode } from '@/shared/lib/error-utils'
import { createApiError, createNetworkError } from '@/shared/lib/error-factory'
import type { ApiError } from '@/shared/types'

const apiClient = axios.create({
  timeout: 30_000,
  // Omit global Content-Type to let Axios auto-detect:
  // - JSON requests  -> application/json
  // - FormData       -> multipart/form-data with boundary
})

// Request interceptor: log outgoing requests, extend for auth later.
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.baseURL = config.baseURL ?? getActiveApiBaseUrl()
  logger.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`)
  return config
})

// Response interceptor: convert errors into structured AppError.
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    // Preserve cancellation semantics so callers can keep cancelled state.
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }

    const status = error.response?.status
    let detail: string
    try {
      detail = error.response?.data ? formatApiError(error.response.data) : error.message
    } catch {
      // Non-conforming response shape (e.g. HTML from proxy).
      detail = error.message
    }

    logger.error(`[API] ${status ?? 'NETWORK'} ${detail}`)

    if (status) {
      const backendCode = error.response?.data ? getApiErrorCode(error.response.data) : undefined
      return Promise.reject(createApiError(status, detail, backendCode))
    }

    // No HTTP status means a network-level failure.
    const code = error.code === 'ECONNABORTED' ? 'NETWORK_TIMEOUT' : 'NETWORK_OFFLINE'
    const i18nKey =
      error.code === 'ECONNABORTED' ? 'error.network.timeout' : 'error.network.offline'
    return Promise.reject(createNetworkError(code, i18nKey))
  },
)

export default apiClient
