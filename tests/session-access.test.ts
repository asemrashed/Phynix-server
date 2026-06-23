import { describe, expect, test } from "bun:test"
import { prisma } from "../src/lib/prisma"
import {
  assertStudentCanAccessSession,
  isSessionPremiumLocked,
  requiresCourseEnrollment,
} from "../src/lib/session-access"
import {
  cleanupTestStudent,
  hasDatabase,
  setStudentSubscription,
} from "./helpers/test-api"

describe("session-access premium gating", () => {
  test("isSessionPremiumLocked when session requires PRO and user lacks access", () => {
    expect(isSessionPremiumLocked({ requiresPremium: true }, false)).toBe(true)
    expect(isSessionPremiumLocked({ requiresPremium: true }, true)).toBe(false)
    expect(isSessionPremiumLocked({ requiresPremium: false }, false)).toBe(false)
  })

  test("requiresCourseEnrollment is independent of premium flag", () => {
    expect(
      requiresCourseEnrollment({
        type: "COURSE_CLASS",
        courseId: "course-1",
        isPublic: false,
      })
    ).toBe(true)

    expect(
      requiresCourseEnrollment({
        type: "PUBLIC_WEBINAR",
        courseId: null,
        isPublic: true,
      })
    ).toBe(false)
  })
})

describe.skipIf(!hasDatabase)("session-access premium gating (database)", () => {
  test("assertStudentCanAccessSession enforces PRO for premium sessions", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const user = await prisma.user.create({
      data: {
        email: `session-access-${suffix}@fxprime.test`,
        passwordHash: "test",
        role: "STUDENT",
        isVerified: true,
        student: {
          create: {
            firstName: "Test",
            lastName: "Student",
          },
        },
      },
      include: { student: true },
    })
    const studentId = user.student!.id

    const premiumSession = {
      type: "QA_SESSION" as const,
      courseId: null,
      isPublic: true,
      requiresPremium: true,
    }

    try {
      await expect(
        assertStudentCanAccessSession(studentId, premiumSession)
      ).rejects.toMatchObject({ code: "PREMIUM_REQUIRED" })

      await setStudentSubscription(studentId, {
        plan: "PRO",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })

      await expect(
        assertStudentCanAccessSession(studentId, premiumSession)
      ).resolves.toBeUndefined()

      await expect(
        assertStudentCanAccessSession(studentId, {
          ...premiumSession,
          requiresPremium: false,
        })
      ).resolves.toBeUndefined()
    } finally {
      await cleanupTestStudent(user.id, studentId)
    }
  })
})
