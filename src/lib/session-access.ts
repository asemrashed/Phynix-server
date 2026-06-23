import { prisma } from "./prisma"
import type { LiveSession } from "@prisma/client"
import { hasPremiumAccess } from "../services/access-control.service"

export type SessionReminderFlags = {
  twentyFourHour?: string
  oneHour?: string
}

export function getSessionReminderFlags(raw: unknown): SessionReminderFlags {
  if (!raw || typeof raw !== "object") return {}
  return raw as SessionReminderFlags
}

export function requiresCourseEnrollment(
  session: Pick<LiveSession, "type" | "courseId" | "isPublic">
): boolean {
  if (session.courseId && session.type === "COURSE_CLASS") return true
  if (session.courseId && !session.isPublic) return true
  return false
}

export function canSelfRegister(
  session: Pick<LiveSession, "type" | "courseId" | "isPublic">
): boolean {
  if (!session.isPublic && !session.courseId) return false
  return true
}

export async function getEnrolledCourseIds(studentId: string): Promise<string[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { courseId: true },
  })
  return enrollments.map((e) => e.courseId)
}

export function isSessionPremiumLocked(
  session: Pick<LiveSession, "requiresPremium">,
  hasPremium: boolean
): boolean {
  return session.requiresPremium && !hasPremium
}

export async function assertStudentCanAccessSession(
  studentId: string,
  session: Pick<LiveSession, "type" | "courseId" | "isPublic" | "requiresPremium">
) {
  if (!canSelfRegister(session)) {
    throw Object.assign(new Error("This session is invite-only"), { code: "ACCESS_DENIED" })
  }

  if (session.requiresPremium) {
    const allowed = await hasPremiumAccess(studentId)
    if (!allowed) {
      throw Object.assign(new Error("PRO subscription required for this session"), {
        code: "PREMIUM_REQUIRED",
      })
    }
  }

  if (!requiresCourseEnrollment(session) || !session.courseId) return

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId: session.courseId } },
  })
  if (!enrollment) {
    throw Object.assign(new Error("You must be enrolled in this course to access this session"), {
      code: "NOT_ENROLLED",
    })
  }
}

export function buildVisibleSessionWhere(
  studentId: string | undefined,
  enrolledCourseIds: string[]
) {
  const base = {
    status: { in: ["SCHEDULED", "COMPLETED"] as string[] },
  }

  if (!studentId) {
    return { ...base, isPublic: true }
  }

  const privateAccess: Array<Record<string, unknown>> = [
    { isPublic: false, registrations: { some: { studentId } } },
  ]
  if (enrolledCourseIds.length > 0) {
    privateAccess.push({
      isPublic: false,
      courseId: { in: enrolledCourseIds },
    })
  }

  return {
    ...base,
    OR: [{ isPublic: true }, ...privateAccess],
  }
}
