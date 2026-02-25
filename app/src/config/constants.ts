/**
 * Application constants.
 *
 * Static values shared across the app. Keep in sync with backend
 * constraints defined in `core/nola/config/constants.py`.
 *
 * NOTE: These constants are manually duplicated from the backend.
 * Future plan: replace with runtime fetch from `GET /api/config`.
 */

/**
 * Task polling interval in milliseconds.
 *
 * NOTE: Consider exponential back-off or longer interval (5-10s) if
 * concurrent users increase. SSE/WebSocket is the long-term solution.
 */
export const POLL_INTERVAL_MS = 2000

/** Maximum file size for upload (500 MB, matches backend). */
export const MAX_FILE_SIZE = 500 * 1024 * 1024

/** Allowed media file extensions (matches backend ALLOWED_EXTENSIONS). */
export const ALLOWED_EXTENSIONS = [
  'mp3',
  'wav',
  'flac',
  'm4a',
  'ogg',
  'webm',
  'aac',
  'mp4',
  'wma',
] as const

/** Allowed MIME types for upload validation (matches backend ALLOWED_AUDIO_TYPES). */
export const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/x-ms-wma',
  'video/mp4',
  'video/webm',
] as const

/** Available export formats. */
export const EXPORT_FORMATS = ['srt', 'vtt', 'txt', 'ass'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

/** Number of recent tasks shown on home page task board. */
export const TASK_BOARD_RECENT_LIMIT = 5

/** Max age (ms) for "recently completed" tasks on home page. */
export const TASK_BOARD_RECENT_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour

/** Default page size for history list. */
export const HISTORY_PAGE_SIZE = 20
