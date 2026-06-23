import { Request, Response, NextFunction } from "express"
import { globalSearch } from "../services/search.service"
import { sendSuccess, sendError } from "../lib/response"

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : ""
    if (!q.trim()) {
      return sendError(res, "VALIDATION_ERROR", "Query parameter q is required", 400)
    }

    const type = req.query.type as "all" | "courses" | "blog" | "products" | undefined
    const limit = req.query.limit ? Number(req.query.limit) : undefined

    const result = await globalSearch(q, { type, limit })
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}
