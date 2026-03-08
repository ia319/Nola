/**
 * Standardized frontend error model.
 *
 * Replaces raw strings with a structured type so the container layer can
 * decide how to display errors without inspecting opaque messages.
 *
 * AD-3: hooks store AppError in state; only the container layer shows toasts.
 */
export interface AppError {
  /** Machine-readable identifier, e.g. `'VALIDATION_EXTENSION'`. */
  code: string
  /** Translation key for react-i18next. */
  i18nKey: string
  /** Interpolation params for the translation template. */
  params?: Record<string, unknown>
  /** Whether the operation can be retried. */
  retriable: boolean
}
