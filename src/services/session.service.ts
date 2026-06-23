import { prisma } from "../lib/prisma"
import {
  canAccessMeeting,
  gateJoinUrl,
  getJoinWindow,
  getSessionPhase,
} from "../lib/meeting-access"
import {
  assertStudentCanAccessSession,
  buildVisibleSessionWhere,
  getEnrolledCourseIds,
  getSessionReminderFlags,
  isSessionPremiumLocked,
} from "../lib/session-access"
import { hasPremiumAccess } from "./access-control.service"
import { notifyUser } from "./notification-dispatch.service"
import type { LiveHubResponse, LiveHubSession, LiveSessionPreview, MentorExperienceItem } from "@fxprime/types"

const RECORDINGS_LOOKBACK_DAYS = 30
const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000"

function formatSessionTime(scheduledAt: Date): string {
  return scheduledAt.toLocaleString("en-US", {
    timeZone: process.env.MEETING_TIMEZONE || "Asia/Dhaka",
  })
}

export async function autoCompletePastSessions() {
  const scheduled = await prisma.liveSession.findMany({
    where: { status: "SCHEDULED" },
    select: { id: true, scheduledAt: true, durationMinutes: true },
  })

  const now = Date.now()
  const idsToComplete = scheduled
    .filter((s) => {
      const { closesAt } = getJoinWindow(s.scheduledAt, s.durationMinutes)
      return now > closesAt.getTime()
    })
    .map((s) => s.id)

  if (idsToComplete.length > 0) {
    await prisma.liveSession.updateMany({
      where: { id: { in: idsToComplete } },
      data: { status: "COMPLETED" },
    })
  }
}

function mapHubSession(
  s: {
    id: string
    title: string
    description: string | null
    platform: string
    scheduledAt: Date
    durationMinutes: number
    type: string
    isPublic: boolean
    requiresPremium: boolean
    courseId: string | null
    status: string
    recordingUrl: string | null
    meetingUrl: string | null
    course?: { slug: string } | null
    _count: { registrations: number }
    registrations?: { joinUrl: string | null; attended: boolean }[]
  },
  hasPremium: boolean
): LiveHubSession {
  const reg = s.registrations?.[0]
  const phase = getSessionPhase(s.scheduledAt, s.durationMinutes)
  const premiumLocked = isSessionPremiumLocked(s, hasPremium)
  const joinTarget = reg?.joinUrl ?? s.meetingUrl
  const gated = reg
    ? gateJoinUrl(joinTarget, s.scheduledAt, s.durationMinutes)
    : {
        joinUrl: null,
        canJoin: false,
        joinOpensAt: gateJoinUrl(null, s.scheduledAt, s.durationMinutes).joinOpensAt,
      }

  const showRecording =
    !!reg &&
    (phase === "ended" || s.status === "COMPLETED") &&
    !!s.recordingUrl

  return {
    id: s.id,
    title: s.title,
    description: s.description,
    platform: s.platform,
    scheduledAt: s.scheduledAt.toISOString(),
    durationMinutes: s.durationMinutes,
    type: s.type,
    isPublic: s.isPublic,
    requiresPremium: s.requiresPremium,
    isPremiumLocked: premiumLocked,
    courseId: s.courseId,
    courseSlug: s.course?.slug ?? null,
    isRegistered: !!reg,
    canJoin: gated.canJoin && !!reg,
    joinOpensAt: gated.joinOpensAt,
    phase,
    status: s.status,
    registrationCount: s._count.registrations,
    attended: reg?.attended,
    recordingUrl: showRecording ? s.recordingUrl : null,
  }
}

export async function getLiveHub(studentId?: string): Promise<LiveHubResponse> {
  await autoCompletePastSessions()

  const recordingsSince = new Date()
  recordingsSince.setDate(recordingsSince.getDate() - RECORDINGS_LOOKBACK_DAYS)

  const enrolledCourseIds = studentId ? await getEnrolledCourseIds(studentId) : []
  const visibility = buildVisibleSessionWhere(studentId, enrolledCourseIds)
  const hasPremium = studentId ? await hasPremiumAccess(studentId) : false

  const sessions = await prisma.liveSession.findMany({
    where: {
      AND: [
        visibility,
        {
          OR: [
            { scheduledAt: { gte: new Date() } },
            {
              status: "COMPLETED",
              scheduledAt: { gte: recordingsSince },
              recordingUrl: { not: null },
            },
          ],
        },
      ],
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      _count: { select: { registrations: true } },
      course: { select: { slug: true } },
      registrations: studentId
        ? { where: { studentId }, select: { joinUrl: true, attended: true } }
        : undefined,
    },
  })

  const mapped = sessions.map((s) => mapHubSession(s, hasPremium))
  const upcoming = mapped.filter((s) => s.phase === "upcoming")
  const liveNow = mapped.filter((s) => s.phase === "live")
  const recordings = mapped
    .filter((s) => s.recordingUrl)
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    )

  return { upcoming, liveNow, recordings }
}

export async function listUpcomingSessions(studentId?: string) {
  const hub = await getLiveHub(studentId)
  return [...hub.liveNow, ...hub.upcoming]
}

export async function getSessionPreview(
  sessionId: string,
  studentId?: string
): Promise<LiveSessionPreview | null> {
  await autoCompletePastSessions()

  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      course: { select: { slug: true } },
      registrations: studentId
        ? { where: { studentId }, select: { id: true } }
        : undefined,
    },
  })

  if (!session || session.status === "CANCELLED") return null

  const hasPremium = studentId ? await hasPremiumAccess(studentId) : false
  const phase = getSessionPhase(session.scheduledAt, session.durationMinutes)
  const premiumLocked = isSessionPremiumLocked(session, hasPremium)
  const isRegistered = studentId ? (session.registrations?.length ?? 0) > 0 : false

  return {
    id: session.id,
    title: session.title,
    description: session.description,
    scheduledAt: session.scheduledAt.toISOString(),
    durationMinutes: session.durationMinutes,
    type: session.type,
    requiresPremium: session.requiresPremium,
    isPremiumLocked: premiumLocked,
    courseId: session.courseId,
    courseSlug: session.course?.slug ?? null,
    isRegistered,
    phase,
  }
}

async function ensureSessionMeeting(sessionId: string) {
  const session = await prisma.liveSession.findUnique({ where: { id: sessionId } })
  if (!session) {
    throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" })
  }
  return session
}

async function sendRegistrationConfirmation(
  student: { firstName: string; user: { id: string; email: string } },
  session: { title: string; scheduledAt: Date }
) {
  const scheduledLabel = formatSessionTime(session.scheduledAt)
  await notifyUser({
    userId: student.user.id,
    type: "LIVE_SESSION_REGISTERED",
    title: `Registered: ${session.title}`,
    message: `You're registered for the live session on ${scheduledLabel}`,
    link: `${frontendUrl()}/live`,
    email: {
      to: student.user.email,
      firstName: student.firstName,
      template: {
        name: "live_session_registered",
        sessionTitle: session.title,
        scheduledAt: scheduledLabel,
      },
    },
  })
}

export async function registerForSession(
  studentId: string,
  sessionId: string,
  options?: { skipAccessCheck?: boolean }
) {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: { _count: { select: { registrations: true } } },
  })

  if (!session) {
    throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" })
  }
  if (session.status !== "SCHEDULED") {
    throw Object.assign(new Error("Session is not open for registration"), {
      code: "INVALID_STATE",
    })
  }
  if (getSessionPhase(session.scheduledAt, session.durationMinutes) === "ended") {
    throw Object.assign(new Error("Session has already ended"), { code: "SESSION_ENDED" })
  }
  if (session._count.registrations >= session.capacity) {
    throw Object.assign(new Error("Session is full"), { code: "CAPACITY_FULL" })
  }

  if (!options?.skipAccessCheck) {
    await assertStudentCanAccessSession(studentId, session)
  }

  const existing = await prisma.sessionRegistration.findUnique({
    where: { sessionId_studentId: { sessionId, studentId } },
  })

  const ensured = await ensureSessionMeeting(sessionId)
  const joinUrl = ensured.meetingUrl

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  })
  if (!student) {
    throw Object.assign(new Error("Student not found"), { code: "NOT_FOUND" })
  }

  const registration = await prisma.sessionRegistration.upsert({
    where: { sessionId_studentId: { sessionId, studentId } },
    create: { sessionId, studentId, joinUrl },
    update: { joinUrl: joinUrl ?? undefined },
  })

  if (!existing) {
    await sendRegistrationConfirmation(student, session)
  }

  return registration
}

export async function getSessionJoinUrl(studentId: string, sessionId: string) {
  const session = await prisma.liveSession.findUnique({ where: { id: sessionId } })
  if (!session) {
    throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" })
  }

  await assertStudentCanAccessSession(studentId, session)

  const registration = await prisma.sessionRegistration.findUnique({
    where: { sessionId_studentId: { sessionId, studentId } },
  })
  if (!registration) {
    throw Object.assign(new Error("Not registered for this session"), { code: "NOT_REGISTERED" })
  }

  if (!canAccessMeeting(session.scheduledAt, session.durationMinutes)) {
    const gated = gateJoinUrl(null, session.scheduledAt, session.durationMinutes)
    throw Object.assign(new Error("Join link not available yet"), {
      code: "JOIN_NOT_AVAILABLE",
      joinOpensAt: gated.joinOpensAt,
    })
  }

  let joinUrl = registration.joinUrl ?? session.meetingUrl
  if (!joinUrl) {
    throw Object.assign(new Error("Join link unavailable"), { code: "JOIN_UNAVAILABLE" })
  }

  await prisma.sessionRegistration.update({
    where: { sessionId_studentId: { sessionId, studentId } },
    data: {
      attended: true,
      attendedAt: registration.attendedAt ?? new Date(),
    },
  })

  return {
    joinUrl,
    platform: session.platform,
    scheduledAt: session.scheduledAt.toISOString(),
  }
}

export async function processLiveSessionReminders() {
  const now = new Date()
  let sent = 0

  const registrations = await prisma.sessionRegistration.findMany({
    where: {
      session: { status: "SCHEDULED" },
    },
    include: {
      session: true,
      student: { include: { user: true } },
    },
  })

  for (const reg of registrations) {
    const session = reg.session
    const hoursUntil = (session.scheduledAt.getTime() - now.getTime()) / (60 * 60 * 1000)
    if (hoursUntil <= 0) continue

    const flags = getSessionReminderFlags(reg.reminderFlags)
    const updates: Record<string, string> = {}
    const scheduledLabel = formatSessionTime(session.scheduledAt)

    if (hoursUntil <= 24 && hoursUntil > 23 && !flags.twentyFourHour) {
      await notifyUser({
        userId: reg.student.user.id,
        type: "LIVE_SESSION_REMINDER",
        title: "Live session in 24 hours",
        message: `${session.title} starts tomorrow`,
        link: `${frontendUrl()}/live`,
        email: {
          to: reg.student.user.email,
          firstName: reg.student.firstName,
          template: {
            name: "live_session_reminder",
            sessionTitle: session.title,
            scheduledAt: scheduledLabel,
            hoursBefore: 24,
          },
        },
      })
      updates.twentyFourHour = now.toISOString()
      sent++
    }

    if (hoursUntil <= 1 && hoursUntil > 0.5 && !flags.oneHour) {
      await notifyUser({
        userId: reg.student.user.id,
        type: "LIVE_SESSION_REMINDER",
        title: "Live session in 1 hour",
        message: `${session.title} starts soon`,
        link: `${frontendUrl()}/live`,
        email: {
          to: reg.student.user.email,
          firstName: reg.student.firstName,
          template: {
            name: "live_session_reminder",
            sessionTitle: session.title,
            scheduledAt: scheduledLabel,
            hoursBefore: 1,
          },
        },
      })
      updates.oneHour = now.toISOString()
      sent++
    }

    if (Object.keys(updates).length > 0) {
      await prisma.sessionRegistration.update({
        where: { id: reg.id },
        data: {
          reminderFlags: { ...flags, ...updates },
        },
      })
    }
  }

  return { sent }
}

export async function listMentors(specialization?: string) {
  const mentors = await prisma.mentor.findMany({
    where: {
      isAvailable: true,
      ...(specialization
        ? {
            specializations: {
              hasSome: [specialization],
            },
          }
        : {}),
    },
    orderBy: { averageRating: "desc" },
  })

  return mentors.map(mapPublicMentor)
}

function parseExperience(value: unknown): MentorExperienceItem[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (item): item is MentorExperienceItem =>
        typeof item === "object" &&
        item !== null &&
        "year" in item &&
        "role" in item &&
        typeof (item as MentorExperienceItem).year === "string" &&
        typeof (item as MentorExperienceItem).role === "string"
    )
    .map((item) => ({ year: item.year, role: item.role }))
}

function mapPublicMentor(m: {
  id: string
  displayName: string
  bio: string | null
  photoUrl: string | null
  headline: string | null
  vision: string | null
  certifications: string[]
  experience: unknown
  specializations: string[]
  sessionDurationMinutes: number
  pricePerSession: unknown
  currency: string
  averageRating: unknown
  totalSessions: number
  isFeatured: boolean
}) {
  return {
    id: m.id,
    displayName: m.displayName,
    bio: m.bio,
    photoUrl: m.photoUrl,
    headline: m.headline,
    vision: m.vision,
    certifications: m.certifications,
    experience: parseExperience(m.experience),
    specializations: m.specializations,
    sessionDurationMinutes: m.sessionDurationMinutes,
    pricePerSession: Number(m.pricePerSession),
    currency: m.currency,
    averageRating: Number(m.averageRating),
    totalSessions: m.totalSessions,
    isFeatured: m.isFeatured,
  }
}

export async function getFeaturedMentor() {
  const mentor =
    (await prisma.mentor.findFirst({
      where: { isFeatured: true, isAvailable: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.mentor.findFirst({
      where: { isAvailable: true },
      orderBy: { averageRating: "desc" },
    }))

  if (!mentor) return null
  return mapPublicMentor(mentor)
}
