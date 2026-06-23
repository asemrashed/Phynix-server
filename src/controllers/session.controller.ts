import { Request, Response, NextFunction } from "express"
import {
  listUpcomingSessions,
  getLiveHub,
  getSessionPreview,
  registerForSession,
  getSessionJoinUrl,
  listMentors,
  getFeaturedMentor,
} from "../services/session.service"
import { sendSuccess, sendError } from "../lib/response"
import { getStudentId } from "../lib/student"
import { param } from "../lib/params"

export async function getSessions(req: Request, res: Response, next: NextFunction) {
  try {
    let studentId: string | undefined
    if (req.user) {
      studentId = (await getStudentId(req.user.userId)) ?? undefined
    }
    const sessions = await listUpcomingSessions(studentId)
    return sendSuccess(res, sessions)
  } catch (err) {
    next(err)
  }
}

export async function getLiveHubSessions(req: Request, res: Response, next: NextFunction) {
  try {
    let studentId: string | undefined
    if (req.user) {
      studentId = (await getStudentId(req.user.userId)) ?? undefined
    }
    const hub = await getLiveHub(studentId)
    return sendSuccess(res, hub)
  } catch (err) {
    next(err)
  }
}

export async function getSessionPreviewHandler(req: Request, res: Response, next: NextFunction) {
  try {
    let studentId: string | undefined
    if (req.user) {
      studentId = (await getStudentId(req.user.userId)) ?? undefined
    }
    const sessionId = param(req.params.sessionId)
    const preview = await getSessionPreview(sessionId, studentId)
    if (!preview) return sendError(res, "NOT_FOUND", "Session not found", 404)
    return sendSuccess(res, preview)
  } catch (err) {
    next(err)
  }
}

export async function registerSession(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const sessionId = param(req.params.sessionId)
    await registerForSession(studentId, sessionId)
    return sendSuccess(res, { registered: true })
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", e.message!, 404)
    if (e.code === "CAPACITY_FULL") return sendError(res, e.code, e.message!, 409)
    if (e.code === "NOT_ENROLLED") return sendError(res, e.code, e.message!, 403)
    if (e.code === "PREMIUM_REQUIRED") return sendError(res, e.code, e.message!, 403)
    if (e.code === "ACCESS_DENIED") return sendError(res, e.code, e.message!, 403)
    if (e.code === "INVALID_STATE" || e.code === "SESSION_ENDED") {
      return sendError(res, e.code, e.message!, 400)
    }
    next(err)
  }
}

export async function joinSession(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const sessionId = param(req.params.sessionId)
    try {
      const join = await getSessionJoinUrl(studentId, sessionId)
      return sendSuccess(res, join)
    } catch (err) {
      const e = err as { code?: string; joinOpensAt?: string; message?: string }
      if (e.code === "NOT_FOUND") return sendError(res, e.code, e.message!, 404)
      if (e.code === "NOT_REGISTERED") return sendError(res, e.code, e.message!, 403)
      if (e.code === "PREMIUM_REQUIRED") return sendError(res, e.code, e.message!, 403)
      if (e.code === "JOIN_NOT_AVAILABLE") {
        return res.status(403).json({
          success: false,
          error: { code: e.code, message: e.message!, joinOpensAt: e.joinOpensAt },
        })
      }
      if (e.code === "JOIN_UNAVAILABLE") return sendError(res, e.code, e.message!, 503)
      throw err
    }
  } catch (err) {
    next(err)
  }
}

export async function getFeaturedMentorProfile(_req: Request, res: Response, next: NextFunction) {
  try {
    const mentor = await getFeaturedMentor()
    if (!mentor) return sendError(res, "NOT_FOUND", "No mentor available", 404)
    return sendSuccess(res, mentor)
  } catch (err) {
    next(err)
  }
}

export async function getMentors(req: Request, res: Response, next: NextFunction) {
  try {
    const specialization = req.query.specialization as string | undefined
    const mentors = await listMentors(specialization)
    return sendSuccess(res, mentors)
  } catch (err) {
    next(err)
  }
}
