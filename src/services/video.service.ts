import type { VideoTokenResponse } from "@fxprime/types"
import { randomUUID } from "crypto"
import { prisma } from "../lib/prisma"
import { getCached, setCached } from "../lib/cache"
import {
  buildYoutubeEmbedUrl,
  resolveLessonVideo,
} from "../lib/video-source"
import { buildVimeoEmbedUrl } from "./vimeo.service"
import { assertInstallmentCourseAccess } from "./installment-access.service"

const TOKEN_TTL_SECONDS = 4 * 60 * 60

function getApiBaseUrl(): string {
  return (
    process.env.API_PUBLIC_URL ||
    `http://localhost:${process.env.PORT || 4000}/api/v1`
  )
}

type VideoAccessContext = {
  enrollment: {
    lessonProgress: { isCompleted: boolean; watchPosition: number }[]
  } | null
  lesson: {
    id: string
    duration: number
    isFree: boolean
    type: string
    vimeoId: string | null
    videoRef: string | null
    videoProvider: string | null
  }
}

async function resolveVideoLessonAccess(
  courseId: string,
  lessonId: string,
  studentId?: string
): Promise<VideoAccessContext> {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, section: { courseId }, type: "VIDEO" },
  })

  if (!lesson) {
    throw Object.assign(new Error("Lesson not found"), { code: "NOT_FOUND" })
  }

  let enrollment: VideoAccessContext["enrollment"] = null
  if (studentId) {
    enrollment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
      include: {
        lessonProgress: {
          where: { lessonId },
          select: { isCompleted: true, watchPosition: true },
        },
      },
    })
  }

  if (!lesson.isFree && !enrollment) {
    throw Object.assign(new Error("Not enrolled in course"), { code: "NOT_ENROLLED" })
  }

  if (studentId && enrollment && !lesson.isFree) {
    await assertInstallmentCourseAccess(studentId, courseId)
  }

  return { enrollment, lesson }
}

async function buildVideoTokenResponse(
  courseId: string,
  lessonId: string,
  lesson: VideoAccessContext["lesson"],
  enrollment: VideoAccessContext["enrollment"],
  studentId?: string
): Promise<VideoTokenResponse> {
  const { provider, ref } = resolveLessonVideo(lesson)

  if (!ref) {
    throw Object.assign(new Error("Video not configured for this lesson"), {
      code: "VIDEO_NOT_CONFIGURED",
    })
  }

  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000)
  const sessionToken = randomUUID()
  const lessonProgress = enrollment?.lessonProgress[0]
  const watchPosition = lessonProgress?.watchPosition ?? 0

  await setCached(
    `video_session:${sessionToken}`,
    {
      studentId: studentId ?? "preview",
      lessonId,
      courseId,
      provider,
      videoRef: ref,
    },
    TOKEN_TTL_SECONDS
  )

  const base = {
    provider,
    expiresAt: expiresAt.toISOString(),
    watchPosition,
    duration: lesson.duration,
    sessionToken,
    isCompleted: lessonProgress?.isCompleted ?? false,
  }

  if (provider === "VIMEO") {
    const embedUrl = await buildVimeoEmbedUrl(ref, {
      startSeconds: watchPosition > 0 ? watchPosition : undefined,
    })
    return { ...base, embedUrl }
  }

  if (provider === "YOUTUBE") {
    const embedUrl = buildYoutubeEmbedUrl(
      ref,
      watchPosition > 0 ? watchPosition : undefined
    )
    return { ...base, embedUrl }
  }

  const streamUrl = `${getApiBaseUrl()}/courses/${courseId}/lessons/${lessonId}/stream?session=${sessionToken}`
  return { ...base, streamUrl }
}

export async function getVideoToken(
  studentId: string,
  courseId: string,
  lessonId: string
): Promise<VideoTokenResponse> {
  const { enrollment, lesson } = await resolveVideoLessonAccess(
    courseId,
    lessonId,
    studentId
  )
  return buildVideoTokenResponse(courseId, lessonId, lesson, enrollment, studentId)
}

export async function getPreviewVideoToken(
  courseId: string,
  lessonId: string
): Promise<VideoTokenResponse> {
  const { enrollment, lesson } = await resolveVideoLessonAccess(courseId, lessonId)

  if (!lesson.isFree) {
    throw Object.assign(new Error("Preview not available for this lesson"), {
      code: "ACCESS_DENIED",
    })
  }

  return buildVideoTokenResponse(courseId, lessonId, lesson, enrollment)
}

export async function validateVideoStreamSession(sessionToken: string) {
  const session = await getCached<{
    studentId: string
    lessonId: string
    courseId: string
    provider: string
    videoRef: string
  }>(`video_session:${sessionToken}`)
  if (!session) {
    throw Object.assign(new Error("Invalid or expired video session"), { code: "INVALID_SESSION" })
  }

  return session
}
