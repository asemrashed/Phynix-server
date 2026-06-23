import { Request, Response, NextFunction } from "express"
import { ZodError } from "zod"
import { sendError } from "../lib/response"
import { AppError, getErrorCode, getErrorStatus } from "../lib/errors"
import { logger } from "../lib/logger"

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error({ err, code: getErrorCode(err) }, err.message)

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => e.message).join(", ")
    return sendError(res, "VALIDATION_ERROR", message, 422)
  }

  if (err instanceof AppError) {
    return sendError(res, err.code, err.message, err.status)
  }

  const code = getErrorCode(err)
  if (code && code !== "INTERNAL_ERROR") {
    return sendError(res, code, err.message, getErrorStatus(err))
  }

  return sendError(res, "INTERNAL_ERROR", "An unexpected error occurred", 500)
}
