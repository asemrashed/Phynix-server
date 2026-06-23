import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"
import {
  getInstructorCourses,
  getInstructorCourseDetail,
  getInstructorCourseStudents,
  getInstructorCourseReviews,
  getInstructorStats,
  getInstructorProfile,
  updateInstructorProfile,
  updateInstructorPhoto,
  getInstructorAnalytics,
} from "../services/instructor.service"

export async function getMyCourses(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const courses = await getInstructorCourses(req.user.userId)
    return sendSuccess(res, courses)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function getCourseDetail(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const course = await getInstructorCourseDetail(req.user.userId, param(req.params.slug))
    return sendSuccess(res, course)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function getCourseStudents(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const page = req.query.page ? Number(req.query.page) : undefined
    const limit = req.query.limit ? Number(req.query.limit) : undefined
    const search = typeof req.query.search === "string" ? req.query.search : undefined
    const result = await getInstructorCourseStudents(req.user.userId, param(req.params.slug), {
      page,
      limit,
      search,
    })
    return sendSuccess(res, result)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function getCourseReviews(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const limit = req.query.limit ? Number(req.query.limit) : 20
    const reviews = await getInstructorCourseReviews(
      req.user.userId,
      param(req.params.slug),
      limit
    )
    return sendSuccess(res, reviews)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const stats = await getInstructorStats(req.user.userId)
    return sendSuccess(res, stats)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const profile = await getInstructorProfile(req.user.userId)
    return sendSuccess(res, profile)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function patchProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const schema = z.object({
      displayName: z.string().min(1).optional(),
      title: z.string().nullable().optional(),
      bio: z.string().nullable().optional(),
    })
    const data = schema.parse(req.body)
    const profile = await updateInstructorProfile(req.user.userId, data)
    return sendSuccess(res, profile)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function uploadPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)

    const file = req.file
    if (!file) {
      return sendError(res, "NO_FILE", "No image uploaded", 400)
    }

    const profile = await updateInstructorPhoto(
      req.user.userId,
      file.buffer,
      file.mimetype,
      file.originalname
    )
    return sendSuccess(res, profile)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    if (error.code === "INVALID_FILE_TYPE" || error.code === "FILE_TOO_LARGE") {
      return sendError(res, error.code, error.message, 400)
    }
    next(err)
  }
}

export async function getAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const analytics = await getInstructorAnalytics(req.user.userId)
    return sendSuccess(res, analytics)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}
