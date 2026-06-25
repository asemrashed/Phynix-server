import { Request, Response, NextFunction } from "express"
import {
  getPreviewVideoToken,
  getVideoToken,
  validateVideoStreamSession,
} from "../services/video.service"
import { streamLessonVideoFile } from "../services/video-stream.service"
import {
  buildYoutubeBridgeHtml,
  parseStoredVideoRef,
  YOUTUBE_EMBED_CSP,
} from "../lib/video-playback.utils"
import { sendSuccess, sendError } from "../lib/response"
import { prisma } from "../lib/prisma"
import { param } from "../lib/params"

export async function getToken(req: Request, res: Response, next: NextFunction) {
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

    const token = await getVideoToken(student.id, courseId, lessonId)
    return sendSuccess(res, token)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_ENROLLED" || error.code === "ACCESS_DENIED") {
      return sendError(res, error.code!, error.message, 403)
    }
    if (error.code === "VIDEO_NOT_CONFIGURED") {
      return sendError(res, error.code, error.message, 422)
    }
    next(err)
  }
}

export async function getPreviewToken(req: Request, res: Response, next: NextFunction) {
  try {
    const courseId = param(req.params.courseId)
    const lessonId = param(req.params.lessonId)
    const token = await getPreviewVideoToken(courseId, lessonId)
    return sendSuccess(res, token)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, error.code, error.message, 404)
    }
    if (error.code === "ACCESS_DENIED" || error.code === "VIDEO_NOT_CONFIGURED") {
      return sendError(res, error.code!, error.message, 403)
    }
    next(err)
  }
}

function resolveClientOrigin(req: Request): string {
  const fromQuery = typeof req.query.origin === "string" ? req.query.origin : ""
  if (fromQuery.startsWith("http://") || fromQuery.startsWith("https://")) {
    return fromQuery
  }
  return process.env.FRONTEND_URL || "http://localhost:3000"
}

async function resolveSessionFromRequest(req: Request, courseId: string, lessonId: string) {
  const sessionToken =
    typeof req.body?.sessionToken === "string"
      ? req.body.sessionToken
      : typeof req.query.session === "string"
        ? req.query.session
        : ""

  if (!sessionToken) {
    throw Object.assign(new Error("Missing video session token"), { code: "INVALID_SESSION" })
  }

  const session = await validateVideoStreamSession(sessionToken)
  if (session.courseId !== courseId || session.lessonId !== lessonId) {
    throw Object.assign(new Error("Invalid video session"), { code: "INVALID_SESSION" })
  }

  return session
}

export async function getPlayMeta(req: Request, res: Response, next: NextFunction) {
  try {
    const courseId = param(req.params.courseId)
    const lessonId = param(req.params.lessonId)
    const session = await resolveSessionFromRequest(req, courseId, lessonId)

    const source = parseStoredVideoRef(session.provider, session.videoRef)
    if (!source) {
      return sendError(res, "VIDEO_NOT_CONFIGURED", "Video not configured for this lesson", 422)
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { title: true },
    })

    return sendSuccess(res, {
      kind: source.kind,
      title: lesson?.title ?? "Lesson video",
    })
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "INVALID_SESSION") {
      return sendError(res, error.code, error.message, 401)
    }
    next(err)
  }
}

export async function serveVideoEmbed(req: Request, res: Response, next: NextFunction) {
  try {
    const courseId = param(req.params.courseId)
    const lessonId = param(req.params.lessonId)
    const session = await resolveSessionFromRequest(req, courseId, lessonId)

    if (session.provider !== "YOUTUBE") {
      return sendError(res, "INVALID_PROVIDER", "Embed not available for this provider", 400)
    }

    const source = parseStoredVideoRef(session.provider, session.videoRef)
    if (!source || source.kind !== "youtube") {
      return sendError(res, "VIDEO_NOT_CONFIGURED", "Invalid or missing video reference", 422)
    }

    const clientOrigin = resolveClientOrigin(req)
    const html = buildYoutubeBridgeHtml(
      source.videoId,
      clientOrigin,
      session.watchPosition ?? 0
    )

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.setHeader("Cache-Control", "no-store")
    res.setHeader("Content-Security-Policy", YOUTUBE_EMBED_CSP)
    res.setHeader("X-Frame-Options", "SAMEORIGIN")
    return res.send(html)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "INVALID_SESSION") {
      return sendError(res, error.code, error.message, 401)
    }
    next(err)
  }
}

export async function streamVideo(req: Request, res: Response, next: NextFunction) {
  try {
    const courseId = param(req.params.courseId)
    const lessonId = param(req.params.lessonId)
    const sessionToken = typeof req.query.session === "string" ? req.query.session : ""

    if (!sessionToken) {
      return sendError(res, "INVALID_SESSION", "Missing video session token", 401)
    }

    const session = await validateVideoStreamSession(sessionToken)
    if (session.courseId !== courseId || session.lessonId !== lessonId) {
      return sendError(res, "INVALID_SESSION", "Invalid video session", 403)
    }

    if (session.provider !== "SELF_HOSTED") {
      return sendError(res, "INVALID_PROVIDER", "Stream not available for this provider", 400)
    }

    streamLessonVideoFile(res, session.videoRef, req.headers.range)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "INVALID_SESSION") {
      return sendError(res, error.code, error.message, 401)
    }
    if (error.code === "NOT_FOUND") {
      return sendError(res, error.code, error.message, 404)
    }
    next(err)
  }
}
