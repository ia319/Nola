/** 422 validation error item (FastAPI). */
export interface ValidationErrorItem {
  loc: (string | number)[]
  msg: string
  type: string
}

export interface ApiErrorDetailObject {
  code: string
  message: string
}

/** Backend error response shape. */
export interface ApiError {
  /** HTTPException -> string/object, 422 ValidationError -> array */
  detail: string | ValidationErrorItem[] | ApiErrorDetailObject
}
