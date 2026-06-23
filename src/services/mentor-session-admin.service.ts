import type {
  AdminLiveSessionDetail,
  AdminMentorDetail,
  MentorExperienceItem,
  SessionType,
} from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { notifyUser } from "./notification-dispatch.service"
import { autoCompletePastSessions, registerForSession } from "./session.service"
import { paginatedResult, type PaginationParams } from "../lib/pagination"
import { logger } from "../lib/logger"


function formatLiveSessionTime(scheduledAt: Date): string {
  return scheduledAt.toLocaleString("en-US", {
    timeZone: process.env.MEETING_TIMEZONE || "Asia/Dhaka",
  })
}

async function notifyLiveSessionRegistrants(
  sessionId: string,
  payload: { type: string; title: string; message: string }
) {
  const registrations = await prisma.sessionRegistration.findMany({
    where: { sessionId },
    include: {
      student: { include: { user: { select: { id: true } } } },
    },
  })

  for (const reg of registrations) {
    const userId = reg.student?.user?.id
    if (!userId) continue
    await notifyUser({
      userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: `/live`,
    })
  }
}

export interface AdminLiveSessionListFilters {
  search?: string
  status?: string
  type?: SessionType
}

function validateSessionConfig(
  type: SessionType,
  courseId: string | null | undefined,
  isPublic: boolean
) {
  if (type === "COURSE_CLASS" && !courseId) {
    throw Object.assign(new Error("Course class sessions must be linked to a course"), {
      code: "VALIDATION_ERROR",
    })
  }
  if (!isPublic && !courseId) {
    throw Object.assign(
      new Error("Private sessions must be linked to a course so enrolled students can register"),
      { code: "VALIDATION_ERROR" }
    )
  }
}

async function countAttended(sessionId: string) {
  return prisma.sessionRegistration.count({
    where: { sessionId, attended: true },
  })
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

export async function listMentorCandidates() {
  const existing = await prisma.mentor.findMany({ select: { userId: true } })
  const taken = new Set(existing.map((m) => m.userId))

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["ADMIN", "INSTRUCTOR"] },
    },
    include: { instructor: true },
    orderBy: { email: "asc" },
  })

  return users
    .filter((u) => !taken.has(u.id))
    .map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      displayName: u.instructor?.displayName ?? u.email.split("@")[0],
    }))
}

export async function listAdminMentors(pagination: PaginationParams) {
  const { page, pageSize, skip } = pagination

  const [mentors, total] = await Promise.all([
    prisma.mentor.findMany({
      include: {
        _count: { select: { slots: true, bookings: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.mentor.count(),
  ])

  const items = mentors.map((m) => ({
    id: m.id,
    userId: m.userId,
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
    isAvailable: m.isAvailable,
    isFeatured: m.isFeatured,
    averageRating: Number(m.averageRating),
    totalSessions: m.totalSessions,
    slotCount: m._count.slots,
    bookingCount: m._count.bookings,
    createdAt: m.createdAt.toISOString(),
  }))

  return paginatedResult(items, total, page, pageSize)
}

export async function getAdminMentor(mentorId: string): Promise<AdminMentorDetail> {
  const mentor = await prisma.mentor.findUnique({
    where: { id: mentorId },
    include: {
      slots: { orderBy: { date: "asc" } },
      _count: { select: { bookings: true } },
    },
  })

  if (!mentor) {
    throw Object.assign(new Error("Mentor not found"), { code: "NOT_FOUND" })
  }

  return {
    id: mentor.id,
    userId: mentor.userId,
    displayName: mentor.displayName,
    bio: mentor.bio,
    photoUrl: mentor.photoUrl,
    headline: mentor.headline,
    vision: mentor.vision,
    certifications: mentor.certifications,
    experience: parseExperience(mentor.experience),
    specializations: mentor.specializations,
    sessionDurationMinutes: mentor.sessionDurationMinutes,
    pricePerSession: Number(mentor.pricePerSession),
    currency: mentor.currency,
    isAvailable: mentor.isAvailable,
    isFeatured: mentor.isFeatured,
    averageRating: Number(mentor.averageRating),
    totalSessions: mentor.totalSessions,
    bookingCount: mentor._count.bookings,
    createdAt: mentor.createdAt.toISOString(),
    slots: mentor.slots.map((s) => ({
      id: s.id,
      mentorId: s.mentorId,
      date: s.date.toISOString(),
      isBooked: s.isBooked,
    })),
  }
}

export async function createMentor(data: {
  userId: string
  displayName: string
  bio?: string
  photoUrl?: string
  headline?: string
  vision?: string
  certifications?: string[]
  experience?: { year: string; role: string }[]
  specializations?: string[]
  sessionDurationMinutes?: number
  pricePerSession: number
  currency?: string
  isAvailable?: boolean
  isFeatured?: boolean
}) {
  const user = await prisma.user.findUnique({ where: { id: data.userId } })
  if (!user) {
    throw Object.assign(new Error("User not found"), { code: "NOT_FOUND" })
  }

  const existing = await prisma.mentor.findUnique({ where: { userId: data.userId } })
  if (existing) {
    throw Object.assign(new Error("User already has a mentor profile"), { code: "ALREADY_EXISTS" })
  }

  const mentor = await prisma.mentor.create({
    data: {
      userId: data.userId,
      displayName: data.displayName,
      bio: data.bio,
      photoUrl: data.photoUrl,
      headline: data.headline,
      vision: data.vision,
      certifications: data.certifications ?? [],
      experience: data.experience ?? [],
      specializations: data.specializations ?? [],
      sessionDurationMinutes: data.sessionDurationMinutes ?? 60,
      pricePerSession: data.pricePerSession,
      currency: data.currency || "BDT",
      isAvailable: data.isAvailable ?? true,
      isFeatured: data.isFeatured ?? false,
    },
  })

  if (data.isFeatured) {
    await prisma.mentor.updateMany({
      where: { id: { not: mentor.id }, isFeatured: true },
      data: { isFeatured: false },
    })
  }

  return getAdminMentor(mentor.id)
}

export async function updateMentor(
  mentorId: string,
  data: {
    displayName?: string
    bio?: string | null
    photoUrl?: string | null
    headline?: string | null
    vision?: string | null
    certifications?: string[]
    experience?: { year: string; role: string }[]
    specializations?: string[]
    sessionDurationMinutes?: number
    pricePerSession?: number
    currency?: string
    isAvailable?: boolean
    isFeatured?: boolean
  }
) {
  const mentor = await prisma.mentor.findUnique({ where: { id: mentorId } })
  if (!mentor) {
    throw Object.assign(new Error("Mentor not found"), { code: "NOT_FOUND" })
  }

  await prisma.mentor.update({ where: { id: mentorId }, data })

  if (data.isFeatured) {
    await prisma.mentor.updateMany({
      where: { id: { not: mentorId }, isFeatured: true },
      data: { isFeatured: false },
    })
  }

  return getAdminMentor(mentorId)
}

export { createMentorSlot, deleteMentorSlot } from "./mentor-slots.service"

export async function listAdminLiveSessions(
  pagination: PaginationParams,
  filters: AdminLiveSessionListFilters = {}
) {
  await autoCompletePastSessions()

  const { page, pageSize, skip } = pagination
  const where: Record<string, unknown> = {}

  if (filters.status) {
    where.status = filters.status
  }
  if (filters.type) {
    where.type = filters.type
  }
  if (filters.search?.trim()) {
    where.title = { contains: filters.search.trim(), mode: "insensitive" }
  }

  const [sessions, total] = await Promise.all([
    prisma.liveSession.findMany({
      where,
      include: {
        _count: { select: { registrations: true } },
      },
      orderBy: { scheduledAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.liveSession.count({ where }),
  ])

  const items = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    platform: s.platform,
    meetingUrl: s.meetingUrl,
    scheduledAt: s.scheduledAt.toISOString(),
    durationMinutes: s.durationMinutes,
    capacity: s.capacity,
    type: s.type,
    courseId: s.courseId,
    isPublic: s.isPublic,
    requiresPremium: s.requiresPremium,
    status: s.status,
    registrationCount: s._count.registrations,
    createdAt: s.createdAt.toISOString(),
  }))

  return paginatedResult(items, total, page, pageSize)
}

export async function getAdminLiveSession(
  sessionId: string,
  options?: {
    meetingProvisionWarning?: string | null
    meetingProvisionError?: string | null
  }
): Promise<AdminLiveSessionDetail> {
  await autoCompletePastSessions()

  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: { _count: { select: { registrations: true } } },
  })

  if (!session) {
    throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" })
  }

  let courseTitle: string | null = null
  if (session.courseId) {
    const course = await prisma.course.findUnique({
      where: { id: session.courseId },
      select: { title: true },
    })
    courseTitle = course?.title ?? null
  }

  const attendedCount = await countAttended(sessionId)

  return {
    id: session.id,
    title: session.title,
    description: session.description,
    platform: session.platform,
    meetingUrl: session.meetingUrl,
    meetingExternalId: session.meetingExternalId,
    scheduledAt: session.scheduledAt.toISOString(),
    durationMinutes: session.durationMinutes,
    capacity: session.capacity,
    type: session.type as SessionType,
    courseId: session.courseId,
    courseTitle,
    recordingUrl: session.recordingUrl,
    isPublic: session.isPublic,
    requiresPremium: session.requiresPremium,
    status: session.status,
    registrationCount: session._count.registrations,
    attendedCount,
    meetingProvisionWarning: options?.meetingProvisionWarning ?? null,
    meetingProvisionError: options?.meetingProvisionError ?? null,
    createdAt: session.createdAt.toISOString(),
  }
}

export async function createLiveSession(data: {
  title: string
  description?: string
  platform?: string
  meetingUrl?: string
  scheduledAt: string
  durationMinutes?: number
  capacity?: number
  type: SessionType
  courseId?: string | null
  recordingUrl?: string | null
  isPublic?: boolean
  requiresPremium?: boolean
}) {
  validateSessionConfig(
    data.type,
    data.courseId ?? null,
    data.isPublic ?? true
  )

  const scheduledAt = new Date(data.scheduledAt)
  if (scheduledAt <= new Date()) {
    throw Object.assign(new Error("Session must be scheduled in the future"), {
      code: "INVALID_DATE",
    })
  }

  if (data.courseId) {
    const course = await prisma.course.findUnique({ where: { id: data.courseId } })
    if (!course) {
      throw Object.assign(new Error("Course not found"), { code: "NOT_FOUND" })
    }
  }

  const session = await prisma.liveSession.create({
    data: {
      title: data.title,
      description: data.description,
      platform: data.platform || "EXTERNAL",
      meetingUrl: data.meetingUrl || null,
      scheduledAt,
      durationMinutes: data.durationMinutes ?? 90,
      capacity: data.capacity ?? 100,
      type: data.type,
      courseId: data.courseId || null,
      recordingUrl: data.recordingUrl,
      isPublic: data.isPublic ?? true,
      requiresPremium: data.requiresPremium ?? false,
      status: "SCHEDULED",
    },
  })

  return getAdminLiveSession(session.id)
}

export async function updateLiveSession(
  sessionId: string,
  data: {
    title?: string
    description?: string | null
    platform?: string
    meetingUrl?: string | null
    scheduledAt?: string
    durationMinutes?: number
    capacity?: number
    type?: SessionType
    courseId?: string | null
    recordingUrl?: string | null
    isPublic?: boolean
    requiresPremium?: boolean
  }
) {
  const session = await prisma.liveSession.findUnique({ where: { id: sessionId } })
  if (!session) {
    throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" })
  }

  if (session.status === "CANCELLED") {
    throw Object.assign(new Error("Cannot edit a cancelled session"), { code: "INVALID_STATE" })
  }

  const mergedType = (data.type ?? session.type) as SessionType
  const mergedCourseId =
    data.courseId !== undefined ? data.courseId : session.courseId
  const mergedIsPublic = data.isPublic !== undefined ? data.isPublic : session.isPublic
  validateSessionConfig(mergedType, mergedCourseId, mergedIsPublic)

  if (data.courseId) {
    const course = await prisma.course.findUnique({ where: { id: data.courseId } })
    if (!course) {
      throw Object.assign(new Error("Course not found"), { code: "NOT_FOUND" })
    }
  }

  const nextScheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : session.scheduledAt
  const scheduledAtChanged =
    !!data.scheduledAt &&
    nextScheduledAt.getTime() !== session.scheduledAt.getTime()
  const meetingUrlProvided = data.meetingUrl !== undefined
  const meetingUrlChanged =
    meetingUrlProvided && data.meetingUrl !== session.meetingUrl

  if (
    session.status === "SCHEDULED" &&
    scheduledAtChanged &&
    nextScheduledAt <= new Date()
  ) {
    throw Object.assign(new Error("Scheduled sessions must remain in the future"), {
      code: "INVALID_DATE",
    })
  }

  const updateData: {
    title?: string
    description?: string | null
    platform?: string
    meetingUrl?: string | null
    meetingExternalId?: string | null
    scheduledAt?: Date
    durationMinutes?: number
    capacity?: number
    type?: SessionType
    courseId?: string | null
    recordingUrl?: string | null
    isPublic?: boolean
    requiresPremium?: boolean
  } = {
    title: data.title,
    description: data.description,
    platform: data.platform,
    meetingUrl: data.meetingUrl,
    scheduledAt: data.scheduledAt ? nextScheduledAt : undefined,
    durationMinutes: data.durationMinutes,
    capacity: data.capacity,
    type: data.type,
    courseId: data.courseId,
    recordingUrl: data.recordingUrl,
    isPublic: data.isPublic,
    requiresPremium: data.requiresPremium,
  }

  if (meetingUrlChanged) {
    updateData.meetingExternalId = null
  }

  await prisma.liveSession.update({
    where: { id: sessionId },
    data: updateData,
  })

  const updatedTitle = data.title ?? session.title
  const recordingAdded =
    !!data.recordingUrl && !session.recordingUrl && data.recordingUrl.length > 0

  if (scheduledAtChanged) {
    await notifyLiveSessionRegistrants(sessionId, {
      type: "LIVE_SESSION_UPDATED",
      title: `Session rescheduled: ${updatedTitle}`,
      message: `New time: ${formatLiveSessionTime(nextScheduledAt)}`,
    })
  } else if (data.title && data.title !== session.title) {
    await notifyLiveSessionRegistrants(sessionId, {
      type: "LIVE_SESSION_UPDATED",
      title: `Session updated: ${updatedTitle}`,
      message: "Check the live desk for the latest details.",
    })
  }

  if (recordingAdded) {
    await notifyLiveSessionRegistrants(sessionId, {
      type: "LIVE_SESSION_RECORDING",
      title: `Recording available: ${updatedTitle}`,
      message: "The session replay is ready to watch.",
    })
  }

  return getAdminLiveSession(sessionId)
}

export async function cancelLiveSession(sessionId: string) {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" })
  }

  if (session.status === "CANCELLED") {
    throw Object.assign(new Error("Session already cancelled"), { code: "INVALID_STATE" })
  }

  await prisma.liveSession.update({
    where: { id: sessionId },
    data: { status: "CANCELLED" },
  })

  const registrations = await prisma.sessionRegistration.findMany({
    where: { sessionId },
    include: {
      student: { include: { user: { select: { id: true, email: true } } } },
    },
  })

  const scheduledLabel = session.scheduledAt.toLocaleString()
  let notified = 0

  for (const reg of registrations) {
    const student = reg.student
    if (!student) continue

    await notifyUser({
      userId: student.user.id,
      type: "SESSION_CANCELLED",
      title: `Live session cancelled: ${session.title}`,
      message: `The session scheduled for ${scheduledLabel} has been cancelled.`,
      link: `${process.env.FRONTEND_URL || "http://localhost:3000"}/live`,
      email: {
        to: student.user.email,
        firstName: student.firstName,
        template: {
          name: "live_session_cancelled",
          sessionTitle: session.title,
          scheduledAt: scheduledLabel,
        },
      },
    })

    notified++
  }

  return { cancelled: true, notified }
}

export async function listLiveSessionRegistrations(
  sessionId: string,
  pagination: PaginationParams
) {
  const session = await prisma.liveSession.findUnique({ where: { id: sessionId } })
  if (!session) {
    throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" })
  }

  const { page, pageSize, skip } = pagination

  const [registrations, total, attendedCount] = await Promise.all([
    prisma.sessionRegistration.findMany({
      where: { sessionId },
      include: {
        student: { include: { user: { select: { email: true } } } },
      },
      orderBy: { registeredAt: "asc" },
      skip,
      take: pageSize,
    }),
    prisma.sessionRegistration.count({ where: { sessionId } }),
    countAttended(sessionId),
  ])

  const items = registrations.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentName: `${r.student.firstName} ${r.student.lastName}`,
    email: r.student.user.email,
    uniqueStudentId: r.student.uniqueStudentId,
    registeredAt: r.registeredAt.toISOString(),
    attended: r.attended,
    attendedAt: r.attendedAt?.toISOString() ?? null,
  }))

  return { ...paginatedResult(items, total, page, pageSize), attendedCount }
}

export async function updateLiveSessionRegistrationAttendance(
  sessionId: string,
  registrationId: string,
  attended: boolean
) {
  const registration = await prisma.sessionRegistration.findFirst({
    where: { id: registrationId, sessionId },
  })
  if (!registration) {
    throw Object.assign(new Error("Registration not found"), { code: "NOT_FOUND" })
  }

  const updated = await prisma.sessionRegistration.update({
    where: { id: registrationId },
    data: {
      attended,
      attendedAt: attended ? registration.attendedAt ?? new Date() : null,
    },
    include: {
      student: { include: { user: { select: { email: true } } } },
    },
  })

  return {
    id: updated.id,
    studentId: updated.studentId,
    studentName: `${updated.student.firstName} ${updated.student.lastName}`,
    email: updated.student.user.email,
    uniqueStudentId: updated.student.uniqueStudentId,
    registeredAt: updated.registeredAt.toISOString(),
    attended: updated.attended,
    attendedAt: updated.attendedAt?.toISOString() ?? null,
  }
}

function mapRegistrationRow(r: {
  id: string
  studentId: string
  registeredAt: Date
  attended: boolean
  attendedAt: Date | null
  student: {
    firstName: string
    lastName: string
    uniqueStudentId: string | null
    user: { email: string }
  }
}) {
  return {
    id: r.id,
    studentId: r.studentId,
    studentName: `${r.student.firstName} ${r.student.lastName}`,
    email: r.student.user.email,
    uniqueStudentId: r.student.uniqueStudentId,
    registeredAt: r.registeredAt.toISOString(),
    attended: r.attended,
    attendedAt: r.attendedAt?.toISOString() ?? null,
  }
}

export async function searchLiveSessionRegistrationCandidates(
  sessionId: string,
  search: string,
  limit = 10
) {
  const session = await prisma.liveSession.findUnique({ where: { id: sessionId } })
  if (!session) {
    throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" })
  }

  const q = search.trim()
  if (q.length < 2) return []

  const registered = await prisma.sessionRegistration.findMany({
    where: { sessionId },
    select: { studentId: true },
  })
  const excludeIds = registered.map((r) => r.studentId)

  const students = await prisma.student.findMany({
    where: {
      id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { uniqueStudentId: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ],
    },
    include: { user: { select: { email: true } } },
    orderBy: { firstName: "asc" },
    take: Math.min(limit, 20),
  })

  return students.map((s) => ({
    studentId: s.id,
    studentName: `${s.firstName} ${s.lastName}`,
    email: s.user.email,
    uniqueStudentId: s.uniqueStudentId,
  }))
}

export async function adminAddLiveSessionRegistration(sessionId: string, studentId: string) {
  const existing = await prisma.sessionRegistration.findUnique({
    where: { sessionId_studentId: { sessionId, studentId } },
  })
  if (existing) {
    throw Object.assign(new Error("Student is already registered for this session"), {
      code: "ALREADY_EXISTS",
    })
  }

  await registerForSession(studentId, sessionId, { skipAccessCheck: true })

  const registration = await prisma.sessionRegistration.findUnique({
    where: { sessionId_studentId: { sessionId, studentId } },
    include: {
      student: { include: { user: { select: { email: true } } } },
    },
  })

  if (!registration) {
    throw Object.assign(new Error("Registration not found"), { code: "NOT_FOUND" })
  }

  return mapRegistrationRow(registration)
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function exportLiveSessionRegistrationsCsv(sessionId: string) {
  const session = await prisma.liveSession.findUnique({ where: { id: sessionId } })
  if (!session) {
    throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" })
  }

  const registrations = await prisma.sessionRegistration.findMany({
    where: { sessionId },
    include: {
      student: { include: { user: { select: { email: true } } } },
    },
    orderBy: { registeredAt: "asc" },
  })

  const header = [
    "Student Name",
    "Email",
    "Student ID",
    "Registered At",
    "Attended",
    "Attended At",
  ].join(",")

  const rows = registrations.map((r) =>
    [
      csvEscape(`${r.student.firstName} ${r.student.lastName}`),
      csvEscape(r.student.user.email),
      csvEscape(r.student.uniqueStudentId ?? ""),
      csvEscape(r.registeredAt.toISOString()),
      r.attended ? "Yes" : "No",
      csvEscape(r.attendedAt?.toISOString() ?? ""),
    ].join(",")
  )

  return [header, ...rows].join("\n")
}
