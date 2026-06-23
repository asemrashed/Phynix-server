import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { prisma } from "../src/lib/prisma"
import {
  markInstallmentPaid,
  markOverdueInstallments,
  upsertInstallmentPlan,
} from "../src/services/installment.service"
import {
  processInstallmentReminders,
  suspendOverdueInstallmentAccess,
} from "../src/services/installment-lifecycle.service"
import {
  assertInstallmentCourseAccess,
  isInstallmentAccessSuspended,
} from "../src/services/installment-access.service"
import { INSTALLMENT_ACCESS_GRACE_DAYS } from "../src/lib/installment-utils"

describe("installment lifecycle", () => {
  let studentId = ""
  let userId = ""
  let courseId = ""
  let agreementId = ""
  let installmentIds: string[] = []

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `installment-${Date.now()}@test.com`,
        passwordHash: "hash",
        role: "STUDENT",
        isVerified: true,
      },
    })
    userId = user.id
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        firstName: "Install",
        lastName: "Payer",
        phone: "01711111111",
      },
    })
    studentId = student.id

    const course = await prisma.course.findFirst({ where: { status: "PUBLISHED" } })
    if (!course) throw new Error("Need a published course in seed data")
    courseId = course.id

    const plan = await upsertInstallmentPlan({
      courseId,
      label: "Test 3-pay",
      totalAmount: 3000,
      installmentCount: 3,
      intervalDays: 30,
      downPaymentPercent: 33,
    })

    const agreement = await prisma.installmentAgreement.create({
      data: {
        studentId,
        planId: plan.id,
        courseId,
        totalAmount: 3000,
        paidAmount: 1000,
        status: "ACTIVE",
        installments: {
          create: [
            {
              installmentNo: 1,
              amount: 1000,
              dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
              status: "PAID",
              paidAt: new Date(),
            },
            {
              installmentNo: 2,
              amount: 1000,
              dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
              status: "PENDING",
            },
            {
              installmentNo: 3,
              amount: 1000,
              dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
              status: "PENDING",
            },
          ],
        },
      },
      include: { installments: true },
    })

    agreementId = agreement.id
    installmentIds = agreement.installments.map((item) => item.id)

    await prisma.enrollment.create({
      data: { studentId, courseId, progress: 0 },
    })
  })

  afterEach(async () => {
    if (agreementId) {
      await prisma.installmentPayment.deleteMany({ where: { agreementId } })
      await prisma.installmentAgreement.deleteMany({ where: { id: agreementId } })
    }
    if (studentId) {
      await prisma.enrollment.deleteMany({ where: { studentId } })
      await prisma.student.deleteMany({ where: { id: studentId } })
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } })
    }
  })

  test("overdue installments mark agreement defaulted and suspend access after grace", async () => {
    await markOverdueInstallments()

    const overdueInstallment = await prisma.installmentPayment.findUniqueOrThrow({
      where: { id: installmentIds[1] },
    })
    expect(overdueInstallment.status).toBe("OVERDUE")

    const defaulted = await prisma.installmentAgreement.findUniqueOrThrow({
      where: { id: agreementId },
    })
    expect(defaulted.status).toBe("DEFAULTED")
    expect(defaulted.accessSuspendedAt).toBeNull()

    await prisma.installmentPayment.update({
      where: { id: installmentIds[1] },
      data: {
        dueDate: new Date(
          Date.now() - (INSTALLMENT_ACCESS_GRACE_DAYS + 1) * 24 * 60 * 60 * 1000
        ),
      },
    })

    const suspended = await suspendOverdueInstallmentAccess()
    expect(suspended).toBe(1)

    expect(await isInstallmentAccessSuspended(studentId, courseId)).toBe(true)
    await expect(assertInstallmentCourseAccess(studentId, courseId)).rejects.toMatchObject({
      code: "INSTALLMENT_SUSPENDED",
    })
  })

  test("paying overdue installment restores course access", async () => {
    await prisma.installmentAgreement.update({
      where: { id: agreementId },
      data: { accessSuspendedAt: new Date(), status: "DEFAULTED" },
    })
    await prisma.installmentPayment.update({
      where: { id: installmentIds[1] },
      data: { status: "OVERDUE" },
    })

    await markInstallmentPaid(installmentIds[1]!)

    const agreement = await prisma.installmentAgreement.findUniqueOrThrow({
      where: { id: agreementId },
    })
    expect(agreement.accessSuspendedAt).toBeNull()
    expect(agreement.status).toBe("ACTIVE")
    expect(await isInstallmentAccessSuspended(studentId, courseId)).toBe(false)
  })

  test("processInstallmentReminders sends overdue notification once", async () => {
    await prisma.installmentPayment.update({
      where: { id: installmentIds[1] },
      data: {
        status: "OVERDUE",
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    })

    const firstRun = await processInstallmentReminders()
    expect(firstRun).toBeGreaterThanOrEqual(1)

    const secondRun = await processInstallmentReminders()
    expect(secondRun).toBe(0)

    const installment = await prisma.installmentPayment.findUniqueOrThrow({
      where: { id: installmentIds[1] },
    })
    const flags = installment.reminderFlags as { overdue?: string }
    expect(flags.overdue).toBeTruthy()
  })
})
