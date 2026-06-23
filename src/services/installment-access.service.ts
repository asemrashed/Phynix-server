import { prisma } from "../lib/prisma"

export async function isInstallmentAccessSuspended(
  studentId: string,
  courseId: string
): Promise<boolean> {
  const agreement = await prisma.installmentAgreement.findFirst({
    where: {
      studentId,
      courseId,
      status: { in: ["ACTIVE", "DEFAULTED"] },
      accessSuspendedAt: { not: null },
    },
    select: { id: true },
  })
  return Boolean(agreement)
}

export async function assertInstallmentCourseAccess(
  studentId: string,
  courseId: string
): Promise<void> {
  const suspended = await isInstallmentAccessSuspended(studentId, courseId)
  if (suspended) {
    throw Object.assign(
      new Error("Course access suspended due to overdue installment payment"),
      { code: "INSTALLMENT_SUSPENDED" }
    )
  }
}
