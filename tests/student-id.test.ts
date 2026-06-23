import { describe, expect, test } from "bun:test"
import bcrypt from "bcrypt"
import { prisma } from "../src/lib/prisma"
import {
  backfillMissingStudentIds,
  clearOrphanStudentIds,
  ensureUniqueStudentId,
  revokeStudentIdIfNoEnrollments,
} from "../src/services/student-id.service"

const hasDatabase = !!process.env.DATABASE_URL

describe.skipIf(!hasDatabase)("Student ID policy", () => {
  test("does not issue ID without enrollment", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const user = await prisma.user.create({
      data: {
        email: `sid-none-${suffix}@fxprime.test`,
        passwordHash: await bcrypt.hash("password123", 12),
        role: "STUDENT",
        isVerified: true,
        student: {
          create: {
            firstName: "No",
            lastName: "Enroll",
            country: "Bangladesh",
            registrationType: "STUDENT",
          },
        },
      },
      include: { student: true },
    })

    try {
      const id = await ensureUniqueStudentId(user.student!.id)
      expect(id).toBeNull()

      const row = await prisma.student.findUnique({
        where: { id: user.student!.id },
        select: { uniqueStudentId: true },
      })
      expect(row?.uniqueStudentId).toBeNull()
    } finally {
      await prisma.user.delete({ where: { id: user.id } })
    }
  })

  test("clears orphan IDs and backfills enrolled students", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const course = await prisma.course.findFirst({
      where: { status: "PUBLISHED" },
      select: { id: true },
    })
    if (!course) return

    const orphan = await prisma.user.create({
      data: {
        email: `sid-orphan-${suffix}@fxprime.test`,
        passwordHash: await bcrypt.hash("password123", 12),
        role: "STUDENT",
        isVerified: true,
        student: {
          create: {
            firstName: "Orphan",
            lastName: "Id",
            country: "Bangladesh",
            registrationType: "STUDENT",
            uniqueStudentId: `FXP-ORPHAN-${suffix}`,
          },
        },
      },
      include: { student: true },
    })

    const enrolled = await prisma.user.create({
      data: {
        email: `sid-enrolled-${suffix}@fxprime.test`,
        passwordHash: await bcrypt.hash("password123", 12),
        role: "STUDENT",
        isVerified: true,
        student: {
          create: {
            firstName: "Needs",
            lastName: "Id",
            country: "Bangladesh",
            registrationType: "STUDENT",
            enrollments: {
              create: { courseId: course.id },
            },
          },
        },
      },
      include: { student: true },
    })

    try {
      const cleared = await clearOrphanStudentIds()
      expect(cleared).toBeGreaterThanOrEqual(1)

      const orphanRow = await prisma.student.findUnique({
        where: { id: orphan.student!.id },
        select: { uniqueStudentId: true },
      })
      expect(orphanRow?.uniqueStudentId).toBeNull()

      const issued = await backfillMissingStudentIds()
      expect(issued).toBeGreaterThanOrEqual(1)

      const enrolledRow = await prisma.student.findUnique({
        where: { id: enrolled.student!.id },
        select: { uniqueStudentId: true },
      })
      expect(enrolledRow?.uniqueStudentId).toMatch(/^FXP-\d{4}-\d{5}$/)

      await prisma.enrollment.deleteMany({ where: { studentId: enrolled.student!.id } })
      const revoked = await revokeStudentIdIfNoEnrollments(enrolled.student!.id)
      expect(revoked).toBe(true)

      const afterRevoke = await prisma.student.findUnique({
        where: { id: enrolled.student!.id },
        select: { uniqueStudentId: true },
      })
      expect(afterRevoke?.uniqueStudentId).toBeNull()
    } finally {
      await prisma.user.deleteMany({
        where: { id: { in: [orphan.id, enrolled.id] } },
      })
    }
  })
})
