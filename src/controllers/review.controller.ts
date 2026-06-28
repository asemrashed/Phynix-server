import { Request, Response, NextFunction } from "express"
import { listRecentCourseReviews } from "../services/review.service"
import { sendSuccess } from "../lib/response"

export async function getRecentReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 20)
    const reviews = await listRecentCourseReviews(limit)
    return sendSuccess(res, reviews)
  } catch (err) {
    next(err)
  }
}
