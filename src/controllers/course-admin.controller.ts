import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  createCourseSchema,
  updateCourseSchema,
  createLessonSchema,
  updateLessonSchema,
} from "@fxprime/types"
import {
  listInstructors,
  getAdminCourseDetail,
  createCourse,
  updateCourse,
  deleteCourse,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  resolveCourseId,
  getAdminCourseStudents,
  getAdminCourseReviews,
} from "../services/course-admin.service"
import { getUploadPublicUrl, saveImageUpload, saveCourseVideoUpload } from "../services/upload.service"
import { sendSuccess, sendError } from "../lib/response"
import { prisma } from "../lib/prisma"
import { param } from "../lib/params"

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  const code = (err as { code?: string }).code
  if (code === "NOT_FOUND") {
    return sendError(res, code, (err as Error).message, 404)
  }
  if (code === "SLUG_EXISTS" || code === "INVALID_ORDER" || code === "INVALID_FILE_TYPE" || code === "FILE_TOO_LARGE" || code === "PUBLISH_BLOCKED") {
    return sendError(res, code, (err as Error).message, 400)
  }
  return next(err)
}

export async function getInstructors(_req: Request, res: Response, next: NextFunction) {
  try {
    const instructors = await listInstructors()
    return sendSuccess(res, instructors)
  } catch (err) {
    next(err)
  }
}

export async function getCourseDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const course = await getAdminCourseDetail(param(req.params.courseId))
    return sendSuccess(res, course)
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function postCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createCourseSchema.parse(req.body)
    const course = await createCourse(data)
    return sendSuccess(res, course, 201)
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function patchCourseDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateCourseSchema.parse(req.body)
    const course = await updateCourse(param(req.params.courseId), data)
    return sendSuccess(res, course)
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function removeCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteCourse(param(req.params.courseId))
    return sendSuccess(res, result)
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function getCourseStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const query = z
      .object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(50).optional(),
        search: z.string().optional(),
      })
      .parse(req.query)
    const result = await getAdminCourseStudents(param(req.params.courseId), query)
    return sendSuccess(res, result)
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function getCourseReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }).parse(req.query)
    const reviews = await getAdminCourseReviews(param(req.params.courseId), limit ?? 50)
    return sendSuccess(res, reviews)
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function postSection(req: Request, res: Response, next: NextFunction) {
  try {
    const { title } = z.object({ title: z.string().min(1) }).parse(req.body)
    const section = await createSection(param(req.params.courseId), title)
    return sendSuccess(res, section, 201)
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function patchSection(req: Request, res: Response, next: NextFunction) {
  try {
    const { title } = z.object({ title: z.string().min(1) }).parse(req.body)
    const section = await updateSection(param(req.params.sectionId), { title })
    return sendSuccess(res, section)
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function removeSection(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteSection(param(req.params.sectionId))
    return sendSuccess(res, result)
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function reorderCourseSections(req: Request, res: Response, next: NextFunction) {
  try {
    const { orderedIds } = z.object({ orderedIds: z.array(z.string().uuid()) }).parse(req.body)
    const sections = await reorderSections(param(req.params.courseId), orderedIds)
    return sendSuccess(res, sections)
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function postLesson(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createLessonSchema.parse(req.body)
    const lesson = await createLesson(param(req.params.sectionId), data)
    return sendSuccess(res, lesson, 201)
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function patchLesson(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateLessonSchema.parse(req.body)
    const lesson = await updateLesson(param(req.params.lessonId), data)
    return sendSuccess(res, lesson)
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function removeLesson(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteLesson(param(req.params.lessonId))
    return sendSuccess(res, result)
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function reorderSectionLessons(req: Request, res: Response, next: NextFunction) {
  try {
    const { orderedIds } = z.object({ orderedIds: z.array(z.string().uuid()) }).parse(req.body)
    const lessons = await reorderLessons(param(req.params.sectionId), orderedIds)
    return sendSuccess(res, lessons)
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function uploadThumbnail(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file
    if (!file) {
      return sendError(res, "NO_FILE", "No file uploaded", 400)
    }

    const relativePath = await saveImageUpload(
      file.buffer,
      file.mimetype,
      file.originalname,
      "thumbnails"
    )
    const url = getUploadPublicUrl(relativePath)
    return sendSuccess(res, { url, path: relativePath })
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}

export async function uploadCourseVideo(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file
    if (!file?.path) {
      return sendError(res, "NO_FILE", "No video uploaded", 400)
    }

    const courseId = await resolveCourseId(param(req.params.courseId))
    const sectionId = param(req.params.sectionId)
    const lessonId = param(req.params.lessonId)

    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        sectionId,
        section: { courseId },
        type: "VIDEO",
      },
    })

    if (!lesson) {
      return sendError(res, "NOT_FOUND", "Video lesson not found", 404)
    }

    const { videoRef } = await saveCourseVideoUpload(
      file.path,
      file.originalname,
      courseId,
      lessonId
    )

    const updated = await updateLesson(lessonId, {
      videoProvider: "SELF_HOSTED",
      videoRef,
    })

    return sendSuccess(res, {
      videoProvider: updated.videoProvider,
      videoRef: updated.videoRef,
    })
  } catch (err) {
    return handleServiceError(err, res, next)
  }
}
