import axios from 'axios'

/**
 * Normalize upload cancellation checks for Axios-based requests.
 */
export function isUploadCanceledError(error: unknown): boolean {
  return axios.isCancel(error)
}
