import type { AdminPendingPaymentItem } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { paginatedResult, type PaginationParams } from "../lib/pagination"
import { fulfillPayment } from "./payment-fulfillment.service"
import { notifyUser } from "./notification-dispatch.service"
import { markInstallmentPaid } from "./installment.service"

async function resolveEntityLabelsBatch(
  payments: { type: string; courseId: string | null; entityId: string | null }[]
): Promise<string[]> {
  const courseIds = [
    ...new Set(
      payments.filter((p) => p.type === "COURSE" && p.courseId).map((p) => p.courseId!)
    ),
  ]

  const courses = courseIds.length
    ? await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } })
    : []

  const courseMap = new Map(courses.map((c) => [c.id, c.title]))

  return payments.map((payment) => {
    if (payment.type === "COURSE" && payment.courseId) {
      return courseMap.get(payment.courseId) || "Course"
    }
    return payment.type
  })
}

export async function listPendingPaymentReviews(pagination: PaginationParams) {
  const { page, pageSize, skip } = pagination

  const where = { status: "AWAITING_VERIFICATION" as const }

  const [rows, total] = await Promise.all([
    prisma.paymentRecord.findMany({
      where,
      include: {
        student: { include: { user: true } },
      },
      orderBy: { submittedAt: "asc" },
      skip,
      take: pageSize,
    }),
    prisma.paymentRecord.count({ where }),
  ])

  const labels = await resolveEntityLabelsBatch(rows)

  const items: AdminPendingPaymentItem[] = rows.map((payment, index) => ({
    id: payment.id,
    type: payment.type,
    status: payment.status,
    amount: Number(payment.amount),
    currency: payment.currency,
    gateway: payment.gateway,
    studentName: `${payment.student.firstName} ${payment.student.lastName}`,
    studentEmail: payment.student.user.email,
    createdAt: payment.createdAt.toISOString(),
    paymentRef: payment.paymentRef,
    tranId: payment.tranId,
    referenceCode: payment.referenceCode,
    senderNumber: payment.senderNumber,
    customerTrxId: payment.customerTrxId,
    proofUrl: payment.proofUrl,
    submittedAt: payment.submittedAt?.toISOString() ?? null,
    rejectReason: payment.rejectReason,
    entityLabel: labels[index]!,
    refund: null,
  }))

  return paginatedResult(items, total, page, pageSize)
}

export async function approveManualPayment(paymentId: string, reviewerId: string) {
  const payment = await prisma.paymentRecord.findUnique({ where: { id: paymentId } })
  if (!payment) throw Object.assign(new Error("Payment not found"), { code: "NOT_FOUND" })
  if (payment.status !== "AWAITING_VERIFICATION") {
    throw Object.assign(new Error("Payment is not awaiting verification"), { code: "INVALID_STATUS" })
  }

  const paymentRef = payment.customerTrxId || payment.referenceCode || payment.tranId || paymentId
  await fulfillPayment(paymentId, paymentRef)

  await prisma.paymentRecord.update({
    where: { id: paymentId },
    data: { reviewedAt: new Date(), reviewedById: reviewerId },
  })

  const installment = await prisma.installmentPayment.findFirst({
    where: { paymentRecordId: paymentId },
    include: { agreement: { include: { plan: true, student: { include: { user: true } } } } },
  })

  if (installment) {
    await markInstallmentPaid(installment.id)
  }

  const student = await prisma.student.findUnique({
    where: { id: payment.studentId },
    include: { user: true },
  })

  if (student) {
    await notifyUser({
      userId: student.userId,
      type: "PAYMENT_APPROVED",
      title: "Payment approved",
      message: "Your payment has been verified. Access is now active.",
      link: `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/courses`,
    })
  }

  return prisma.paymentRecord.findUniqueOrThrow({ where: { id: paymentId } })
}

export async function rejectManualPayment(
  paymentId: string,
  reviewerId: string,
  reason?: string
) {
  const payment = await prisma.paymentRecord.findUnique({
    where: { id: paymentId },
    include: { student: { include: { user: true } } },
  })
  if (!payment) throw Object.assign(new Error("Payment not found"), { code: "NOT_FOUND" })
  if (payment.status !== "AWAITING_VERIFICATION") {
    throw Object.assign(new Error("Payment is not awaiting verification"), { code: "INVALID_STATUS" })
  }

  const rejectReason = reason?.trim() || "Payment could not be verified"

  await prisma.paymentRecord.update({
    where: { id: paymentId },
    data: {
      status: "REJECTED",
      rejectReason,
      reviewedAt: new Date(),
      reviewedById: reviewerId,
    },
  })

  const installment = await prisma.installmentPayment.findFirst({
    where: { paymentRecordId: paymentId },
  })
  if (installment) {
    await prisma.installmentPayment.update({
      where: { id: installment.id },
      data: { status: "PENDING", paymentRecordId: null },
    })
  }

  await notifyUser({
    userId: payment.student.userId,
    type: "PAYMENT_REJECTED",
    title: "Payment rejected",
    message: rejectReason,
    link: `${process.env.FRONTEND_URL || "http://localhost:3000"}/checkout/manual?paymentId=${paymentId}`,
  })

  return prisma.paymentRecord.findUniqueOrThrow({ where: { id: paymentId } })
}
