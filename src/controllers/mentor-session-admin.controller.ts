import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  listMentorCandidates,
  listAdminMentors,
  getAdminMentor,
  createMentor,
  updateMentor,
  createMentorSlot,
  deleteMentorSlot,
  listAdminLiveSessions,
  getAdminLiveSession,
  createLiveSession,
  updateLiveSession,
  cancelLiveSession,
  listLiveSessionRegistrations,
  updateLiveSessionRegistrationAttendance,
  searchLiveSessionRegistrationCandidates,
  adminAddLiveSessionRegistration,
  exportLiveSessionRegistrationsCsv,
} from "../services/mentor-session-admin.service"
import {
  updateMentorBookingNotes,
  listMentorBookingsForAdmin,
} from "../services/mentor.service"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"
import { parsePagination } from "../lib/pagination"

const sessionType = z.enum([
  "COURSE_CLASS",
  "PUBLIC_WEBINAR",
  "QA_SESSION",
  "GROUP_MENTORSHIP",
])

function handleError(err: unknown, res: Response, next: NextFunction) {
  const code = (err as { code?: string }).code
  if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
  if (
    code === "ALREADY_EXISTS" ||
    code === "INVALID_DATE" ||
    code === "SLOT_BOOKED" ||
    code === "INVALID_STATE" ||
    code === "VALIDATION_ERROR" ||
    code === "CAPACITY_FULL" ||
    code === "SESSION_ENDED" ||
    code === "MEETING_EXISTS"
  ) {
    return sendError(res, code, (err as Error).message, 400)
  }
  return next(err)
}

export async function getMentorCandidates(_req: Request, res: Response, next: NextFunction) {
  try {
    const candidates = await listMentorCandidates()
    return sendSuccess(res, candidates)
  } catch (err) {
    next(err)
  }
}

export async function getMentors(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const result = await listAdminMentors(pagination)
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function getMentorDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const mentor = await getAdminMentor(param(req.params.mentorId))
    return sendSuccess(res, mentor)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function postMentor(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      userId: z.string().uuid(),
      displayName: z.string().min(2),
      bio: z.string().optional(),
      photoUrl: z.string().optional(),
      headline: z.string().optional(),
      vision: z.string().optional(),
      certifications: z.array(z.string()).optional(),
      experience: z.array(z.object({ year: z.string(), role: z.string() })).optional(),
      specializations: z.array(z.string()).optional(),
      sessionDurationMinutes: z.number().int().min(15).optional(),
      pricePerSession: z.number().min(0),
      currency: z.string().optional(),
      isAvailable: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
    })
    const data = schema.parse(req.body)
    const mentor = await createMentor(data)
    return sendSuccess(res, mentor, 201)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function patchMentor(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      displayName: z.string().min(2).optional(),
      bio: z.string().nullable().optional(),
      photoUrl: z.string().nullable().optional(),
      headline: z.string().nullable().optional(),
      vision: z.string().nullable().optional(),
      certifications: z.array(z.string()).optional(),
      experience: z.array(z.object({ year: z.string(), role: z.string() })).optional(),
      specializations: z.array(z.string()).optional(),
      sessionDurationMinutes: z.number().int().min(15).optional(),
      pricePerSession: z.number().min(0).optional(),
      currency: z.string().optional(),
      isAvailable: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
    })
    const data = schema.parse(req.body)
    const mentor = await updateMentor(param(req.params.mentorId), data)
    return sendSuccess(res, mentor)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function postMentorSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const { date } = z.object({ date: z.string().datetime() }).parse(req.body)
    const slot = await createMentorSlot(param(req.params.mentorId), date)
    return sendSuccess(res, slot, 201)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function removeMentorSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteMentorSlot(
      param(req.params.mentorId),
      param(req.params.slotId)
    )
    return sendSuccess(res, result)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function getMentorBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const result = await listMentorBookingsForAdmin(param(req.params.mentorId), pagination)
    return sendSuccess(res, result)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function patchMentorBookingNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionNotes } = z
      .object({ sessionNotes: z.string().max(2000).nullable() })
      .parse(req.body)
    const booking = await updateMentorBookingNotes(
      param(req.params.bookingId),
      sessionNotes
    )
    return sendSuccess(res, booking)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function getLiveSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const search = typeof req.query.search === "string" ? req.query.search : undefined
    const status = typeof req.query.status === "string" ? req.query.status : undefined
    const type =
      typeof req.query.type === "string"
        ? sessionType.safeParse(req.query.type).data
        : undefined
    const result = await listAdminLiveSessions(pagination, { search, status, type })
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function getLiveSessionDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await getAdminLiveSession(param(req.params.sessionId))
    return sendSuccess(res, session)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function postLiveSession(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      title: z.string().min(3),
      description: z.string().optional(),
      platform: z.string().optional(),
      meetingUrl: z.string().optional(),
      scheduledAt: z.string().datetime(),
      durationMinutes: z.number().int().min(15).optional(),
      capacity: z.number().int().min(1).optional(),
      type: sessionType,
      courseId: z.string().uuid().nullable().optional(),
      recordingUrl: z.string().nullable().optional(),
      isPublic: z.boolean().optional(),
      requiresPremium: z.boolean().optional(),
    })
    const data = schema.parse(req.body)
    const session = await createLiveSession(data)
    return sendSuccess(res, session, 201)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function patchLiveSession(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      title: z.string().min(3).optional(),
      description: z.string().nullable().optional(),
      platform: z.string().optional(),
      meetingUrl: z.string().nullable().optional(),
      scheduledAt: z.string().datetime().optional(),
      durationMinutes: z.number().int().min(15).optional(),
      capacity: z.number().int().min(1).optional(),
      type: sessionType.optional(),
      courseId: z.string().uuid().nullable().optional(),
      recordingUrl: z.string().nullable().optional(),
      isPublic: z.boolean().optional(),
      requiresPremium: z.boolean().optional(),
    })
    const data = schema.parse(req.body)
    const session = await updateLiveSession(param(req.params.sessionId), data)
    return sendSuccess(res, session)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function cancelSession(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await cancelLiveSession(param(req.params.sessionId))
    return sendSuccess(res, result)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function getLiveSessionRegistrations(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const result = await listLiveSessionRegistrations(
      param(req.params.sessionId),
      pagination
    )
    return sendSuccess(res, result)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function patchLiveSessionRegistration(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { attended } = z.object({ attended: z.boolean() }).parse(req.body)
    const registration = await updateLiveSessionRegistrationAttendance(
      param(req.params.sessionId),
      param(req.params.registrationId),
      attended
    )
    return sendSuccess(res, registration)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function getLiveSessionRegistrationCandidates(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : ""
    const candidates = await searchLiveSessionRegistrationCandidates(
      param(req.params.sessionId),
      search
    )
    return sendSuccess(res, candidates)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function postLiveSessionRegistration(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { studentId } = z.object({ studentId: z.string().uuid() }).parse(req.body)
    const registration = await adminAddLiveSessionRegistration(
      param(req.params.sessionId),
      studentId
    )
    return sendSuccess(res, registration, 201)
  } catch (err) {
    return handleError(err, res, next)
  }
}

export async function exportLiveSessionRegistrations(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const csv = await exportLiveSessionRegistrationsCsv(param(req.params.sessionId))
    res.setHeader("Content-Type", "text/csv")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="session-registrants-${param(req.params.sessionId)}.csv"`
    )
    return res.send(csv)
  } catch (err) {
    return handleError(err, res, next)
  }
}
