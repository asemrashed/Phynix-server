import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  listRecentCourseReviews,
  listAdminCourseReviews,
  updateAdminCourseReview,
  deleteAdminCourseReview,
} from "../services/review.service"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"
import { parsePagination } from "../lib/pagination"

export async function getRecentReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 20)
    const reviews = await listRecentCourseReviews(limit)
    return sendSuccess(res, reviews)
  } catch (err) {
    next(err)
  }
}

export async function getAdminReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const result = await listAdminCourseReviews(pagination)
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function patchAdminReview(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      isPublished: z.boolean(),
    })
    const data = schema.parse(req.body)
    const review = await updateAdminCourseReview(param(req.params.reviewId), data)
    return sendSuccess(res, review)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
    next(err)
  }
}

export async function removeAdminReview(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteAdminCourseReview(param(req.params.reviewId))
    return sendSuccess(res, result)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
    next(err)
  }
}
