import { Request, Response, NextFunction } from "express"
import { sendError } from "../lib/response"

export function blockInProduction(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (process.env.NODE_ENV === "production") {
    return sendError(
      res,
      "NOT_AVAILABLE",
      "This endpoint is disabled in production",
      403
    )
  }
  next()
}
