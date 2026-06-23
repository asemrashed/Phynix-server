export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400
  ) {
    super(message)
    this.name = "AppError"
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}

export function getErrorCode(err: unknown): string | undefined {
  if (isAppError(err)) return err.code
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: unknown }).code
    return typeof code === "string" ? code : undefined
  }
  return undefined
}

export function getErrorStatus(err: unknown): number {
  if (isAppError(err)) return err.status
  const code = getErrorCode(err)
  if (code === "NOT_FOUND") return 404
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return 403
  if (code === "OUT_OF_STOCK") return 409
  if (code === "VALIDATION_ERROR") return 422
  return 400
}
