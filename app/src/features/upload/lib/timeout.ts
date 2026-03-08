/**
 * Compute per-file upload timeout in milliseconds.
 *
 * Scale linearly with file size (1.3s per 512KB), clamp to [30s, 1800s].
 */
export function computeUploadTimeoutMs(fileSize: number): number {
  return Math.min(1800, Math.max(30, Math.ceil((fileSize / (512 * 1024)) * 1.3))) * 1000
}
