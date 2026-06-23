import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"

export const DEFAULT_REGISTRATION_TYPE = "STUDENT"

export async function generateStudentId(): Promise<string> {
  const year = new Date().getFullYear()

  const counter = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.studentIdCounter.findUnique({
      where: { id: "global" },
    })

    if (!existing) {
      return tx.studentIdCounter.create({
        data: { id: "global", count: 1 },
      })
    }

    return tx.studentIdCounter.update({
      where: { id: "global" },
      data: { count: { increment: 1 } },
    })
  })

  const padded = String(counter.count).padStart(5, "0")
  return `FXP-${year}-${padded}`
}

export async function generateCertCode(): Promise<string> {
  const year = new Date().getFullYear()

  const counter = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.certIdCounter.findUnique({
      where: { id: "global" },
    })

    if (!existing) {
      return tx.certIdCounter.create({
        data: { id: "global", count: 1 },
      })
    }

    return tx.certIdCounter.update({
      where: { id: "global" },
      data: { count: { increment: 1 } },
    })
  })

  const padded = String(counter.count).padStart(5, "0")
  return `CERT-FXP-${year}-${padded}`
}

export async function ensureUniqueStudentId(studentId: string): Promise<string | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { uniqueStudentId: true },
  })

  if (!student) {
    throw Object.assign(new Error("Student not found"), { code: "NOT_FOUND" })
  }

  if (student.uniqueStudentId) {
    return student.uniqueStudentId
  }

  const enrollmentCount = await prisma.enrollment.count({ where: { studentId } })
  if (enrollmentCount === 0) {
    return null
  }

  const uniqueStudentId = await generateStudentId()
  await prisma.student.update({
    where: { id: studentId },
    data: { uniqueStudentId },
  })

  return uniqueStudentId
}

/** Clears public student ID when the user has no course enrollments. */
export async function revokeStudentIdIfNoEnrollments(studentId: string): Promise<boolean> {
  const enrollmentCount = await prisma.enrollment.count({ where: { studentId } })
  if (enrollmentCount > 0) return false

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { uniqueStudentId: true },
  })
  if (!student?.uniqueStudentId) return false

  await prisma.student.update({
    where: { id: studentId },
    data: { uniqueStudentId: null },
  })
  return true
}

/** Removes IDs from accounts that never enrolled in a course. */
export async function clearOrphanStudentIds(): Promise<number> {
  const orphans = await prisma.student.findMany({
    where: {
      uniqueStudentId: { not: null },
      enrollments: { none: {} },
    },
    select: { id: true },
  })
  if (orphans.length === 0) return 0

  const result = await prisma.student.updateMany({
    where: { id: { in: orphans.map((s) => s.id) } },
    data: { uniqueStudentId: null },
  })
  return result.count
}

/** Issues IDs for enrolled students missing one (one-time / recovery backfill). */
export async function backfillMissingStudentIds(): Promise<number> {
  const students = await prisma.student.findMany({
    where: {
      uniqueStudentId: null,
      enrollments: { some: {} },
    },
    select: { id: true },
  })

  let issued = 0
  for (const student of students) {
    const id = await ensureUniqueStudentId(student.id)
    if (id) issued++
  }
  return issued
}

export async function runStudentIdDataBackfill(): Promise<{
  cleared: number
  issued: number
}> {
  const cleared = await clearOrphanStudentIds()
  const issued = await backfillMissingStudentIds()
  return { cleared, issued }
}
