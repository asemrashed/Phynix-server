import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { prisma } from "../src/lib/prisma"
import {
  submitManualPaymentProof,
  enrichManualPaymentRecord,
} from "../src/services/manual-payment.service"
import {
  approveManualPayment,
  rejectManualPayment,
} from "../src/services/payment-review.service"
import { updateManualPaymentMethod } from "../src/services/manual-payment-method.service"
import { updateAdminPaymentSettings } from "../src/services/payment-gateway.service"
import { createPaymentRecord } from "../src/services/payment-core.service"

describe("manual payments", () => {
  let studentId = ""
  let userId = ""
  let paymentId = ""

  beforeEach(async () => {
    await updateManualPaymentMethod("bkash", {
      enabled: true,
      merchantNumber: "01700000001",
      merchantName: "FX Prime",
    })
    await updateAdminPaymentSettings({
      enabledGateways: ["bkash"],
      defaultGateway: "bkash",
      allowUserChoice: true,
    })

    const user = await prisma.user.create({
      data: {
        email: `manual-pay-${Date.now()}@test.com`,
        passwordHash: "hash",
        role: "STUDENT",
        isVerified: true,
      },
    })
    userId = user.id
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        firstName: "Manual",
        lastName: "Payer",
        phone: "01711111111",
      },
    })
    studentId = student.id

    const course = await prisma.course.findFirst({ where: { status: "PUBLISHED" } })
    if (!course) throw new Error("Need a published course in seed data")

    const payment = await createPaymentRecord({
      studentId,
      userId,
      type: "COURSE",
      amount: Number(course.price),
      currency: "BDT",
      gateway: "bkash",
      productName: course.title,
      courseId: course.id,
      customer: { name: "Manual Payer", email: user.email },
    })
    await enrichManualPaymentRecord(payment.id)
    paymentId = payment.id
  })

  afterEach(async () => {
    if (paymentId) {
      await prisma.installmentPayment.deleteMany({ where: { paymentRecordId: paymentId } })
      await prisma.paymentRecord.deleteMany({ where: { id: paymentId } })
    }
    if (studentId) {
      await prisma.enrollment.deleteMany({ where: { studentId } })
      await prisma.student.deleteMany({ where: { id: studentId } })
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } })
    }
  })

  test("submit proof moves payment to AWAITING_VERIFICATION", async () => {
    const details = await submitManualPaymentProof(paymentId, studentId, {
      senderNumber: "01722222222",
      customerTrxId: `TRX${Date.now()}`,
    })
    expect(details.status).toBe("AWAITING_VERIFICATION")
  })

  test("duplicate trx id is rejected", async () => {
    const trx = `TRX${Date.now()}`
    await submitManualPaymentProof(paymentId, studentId, {
      senderNumber: "01722222222",
      customerTrxId: trx,
    })

    const other = await createPaymentRecord({
      studentId,
      userId,
      type: "COURSE",
      amount: 100,
      currency: "BDT",
      gateway: "bkash",
      productName: "Other",
      courseId: (await prisma.course.findFirst())!.id,
      customer: { name: "Manual Payer", email: "x@test.com" },
    })

    await expect(
      submitManualPaymentProof(other.id, studentId, {
        senderNumber: "01733333333",
        customerTrxId: trx,
      })
    ).rejects.toMatchObject({ code: "DUPLICATE_TRX" })

    await prisma.paymentRecord.delete({ where: { id: other.id } })
  })

  test("admin approve completes payment and enrolls student", async () => {
    await submitManualPaymentProof(paymentId, studentId, {
      senderNumber: "01722222222",
      customerTrxId: `TRX${Date.now()}`,
    })

    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } })
    expect(admin).toBeTruthy()

    await approveManualPayment(paymentId, admin!.id)

    const payment = await prisma.paymentRecord.findUniqueOrThrow({ where: { id: paymentId } })
    expect(payment.status).toBe("COMPLETED")

    const paymentCourseId = payment.courseId
    expect(paymentCourseId).toBeTruthy()
    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId: paymentCourseId! } },
    })
    expect(enrollment).toBeTruthy()
  })

  test("submit proof with screenshot url stores proofUrl", async () => {
    const details = await submitManualPaymentProof(paymentId, studentId, {
      senderNumber: "01722222222",
      customerTrxId: `TRX${Date.now()}`,
      proofUrl: "https://example.com/proof.jpg",
    })
    expect(details.status).toBe("AWAITING_VERIFICATION")
    expect(details.proofUrl).toBe("https://example.com/proof.jpg")
  })

  test("admin reject sets rejected status", async () => {
    await submitManualPaymentProof(paymentId, studentId, {
      senderNumber: "01722222222",
      customerTrxId: `TRX${Date.now()}`,
    })

    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } })
    await rejectManualPayment(paymentId, admin!.id, "Wrong amount")

    const payment = await prisma.paymentRecord.findUniqueOrThrow({ where: { id: paymentId } })
    expect(payment.status).toBe("REJECTED")
    expect(payment.rejectReason).toBe("Wrong amount")
  })
})
