import { Response } from "express"
import type { ApiErrorBody } from "@fxprime/types"

export function sendSuccess<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data })
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  status = 400
) {
  const error: ApiErrorBody = { code, message }
  return res.status(status).json({ success: false, error })
}
