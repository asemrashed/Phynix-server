import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  listCourses,
  getCourseBySlug,
  enrollInCourse,
  getEnrollmentProgress,
  getStudentLesson,
  updateLessonProgress,
  getStudentEnrollments,
} from "../services/course.service"
import { canBypassPremiumGate } from "../services/access-control.service"
import {
  listCourseReviews,
  submitCourseReview,
} from "../services/review.service"
import { sendSuccess, sendError } from "../lib/response"
import { prisma } from "../lib/prisma"
import { param } from "../lib/params"

export async function getCourses(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      level: req.query.level as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | undefined,
      language: req.query.language as string | undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      featured: req.query.featured === "true" ? true : undefined,
      free: req.query.free === "true" ? true : undefined,
      sort: req.query.sort as "newest" | "popular" | "price_asc" | "price_desc" | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 12,
    }

    let studentId: string | undefined
    if (req.user) {
      const student = await prisma.student.findUnique({
        where: { userId: req.user.userId },
      })
      studentId = student?.id
    }

    const result = await listCourses(filters, studentId)
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function getCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = param(req.params.slug)

    let studentId: string | undefined
    if (req.user) {
      const student = await prisma.student.findUnique({
        where: { userId: req.user.userId },
      })
      studentId = student?.id
    }

    const preview =
      req.query.preview === "1" || req.query.preview === "true"
    const canPreview =
      preview && canBypassPremiumGate(req.user?.role)

    const course = await getCourseBySlug(slug, studentId, {
      previewUnpublished: canPreview,
    })
    if (!course) {
      return sendError(res, "NOT_FOUND", "Course not found", 404)
    }
    return sendSuccess(res, course)
  } catch (err) {
    next(err)
  }
}

export async function enroll(req: Request, res: Response, next: NextFunction) {
  try {
    const courseId = param(req.params.courseId)
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }

    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
    })
    if (!student) {
      return sendError(res, "NOT_FOUND", "Student profile not found", 404)
    }

    const result = await enrollInCourse(student.id, courseId, req.user.userId)
    return sendSuccess(res, result, 201)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "PAYMENT_REQUIRED") {
      return sendError(res, "PAYMENT_REQUIRED", error.message, 402)
    }
    if (error.code === "ALREADY_ENROLLED") {
      return sendError(res, "ALREADY_ENROLLED", error.message, 409)
    }
    next(err)
  }
}

export async function getProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const courseId = param(req.params.courseId)
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }

    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
    })
    if (!student) {
      return sendError(res, "NOT_FOUND", "Student not found", 404)
    }

    const progress = await getEnrollmentProgress(student.id, courseId)
    if (!progress) {
      return sendError(res, "NOT_ENROLLED", "Not enrolled in this course", 404)
    }
    return sendSuccess(res, progress)
  } catch (err) {
    next(err)
  }
}

export async function getLesson(req: Request, res: Response, next: NextFunction) {
  try {
    const courseId = param(req.params.courseId)
    const lessonId = param(req.params.lessonId)

    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }

    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
    })
    if (!student) {
      return sendError(res, "NOT_FOUND", "Student not found", 404)
    }

    const lesson = await getStudentLesson(student.id, courseId, lessonId)
    return sendSuccess(res, lesson)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_ENROLLED") {
      return sendError(res, "NOT_ENROLLED", error.message, 403)
    }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function updateProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const courseId = param(req.params.courseId)
    const lessonId = param(req.params.lessonId)
    const schema = z.object({
      watchPosition: z.number().optional(),
      isCompleted: z.boolean().optional(),
      quizAnswers: z.record(z.string(), z.number()).optional(),
    })
    const data = schema.parse(req.body)

    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }

    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
    })
    if (!student) {
      return sendError(res, "NOT_FOUND", "Student not found", 404)
    }

    const result = await updateLessonProgress(
      student.id,
      courseId,
      lessonId,
      req.user.userId,
      data
    )
    return sendSuccess(res, result)
  } catch (err) {
    const error = err as Error & { code?: string; score?: number }
    if (error.code === "NOT_ENROLLED") {
      return sendError(res, "NOT_ENROLLED", error.message, 403)
    }
    if (error.code === "QUIZ_MAX_ATTEMPTS" || error.code === "QUIZ_ALREADY_PASSED") {
      return sendError(res, error.code, error.message, 400)
    }
    next(err)
  }
}

export async function getCourseReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const courseId = param(req.params.courseId)
    const reviews = await listCourseReviews(courseId)
    return sendSuccess(res, reviews)
  } catch (err) {
    next(err)
  }
}

export async function submitReview(req: Request, res: Response, next: NextFunction) {
  try {
    const courseId = param(req.params.courseId)
    const schema = z.object({
      rating: z.number().int().min(1).max(5),
      review: z.string().max(1000).optional(),
    })
    const body = schema.parse(req.body)

    const student = await prisma.student.findUnique({
      where: { userId: req.user!.userId },
    })
    if (!student) {
      return sendError(res, "NOT_FOUND", "Student profile not found", 404)
    }

    try {
      const result = await submitCourseReview(
        student.id,
        courseId,
        body.rating,
        body.review
      )
      return sendSuccess(res, result, 201)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === "NOT_ENROLLED" || code === "INVALID_RATING" || code === "CANNOT_REVIEW_YET") {
        return sendError(res, code, (err as Error).message, 400)
      }
      throw err
    }
  } catch (err) {
    next(err)
  }
}

export async function getMyEnrollments(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }

    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
    })
    if (!student) {
      return sendError(res, "NOT_FOUND", "Student not found", 404)
    }

    const enrollments = await getStudentEnrollments(student.id)
    return sendSuccess(res, enrollments)
  } catch (err) {
    next(err)
  }
}
