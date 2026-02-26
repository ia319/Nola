/** 422 validation error item (FastAPI). */
export interface ValidationErrorItem {
  loc: (string | number)[]
  msg: string
  type: string
}

/** Backend error response shape. */
export interface ApiError {
  /** HTTPException -> string, 422 ValidationError -> array */
  detail: string | ValidationErrorItem[]
}

/** Extract human-readable message from ApiError. */
export function formatApiError(data: ApiError): string {
  if (typeof data.detail === 'string') return data.detail
  return data.detail.map((e) => e.msg).join('; ')
}
