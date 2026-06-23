import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { cancelOrderWithRestock } from "./order-admin.service"
import { sendRefundConfirmationEmail } from "./email.service"
import { createNotification } from "./notification.service"
import { paginatedResult, type PaginationParams } from "../lib/pagination"
import { revokeStudentIdIfNoEnrollments } from "./student-id.service"

export interface RefundInput {
  type: "full" | "partial"
  amount?: number
  reason?: string
}

type PaymentRow = Awaited<ReturnType<typeof prisma.paymentRecord.findUnique>>

async function resolveEntityLabelsBatch(
  payments: {
    type: string
    courseId: string | null
    entityId: string | null
  }[]
): Promise<string[]> {
  const courseIds = [
    ...new Set(
      payments.filter((p) => p.type === "COURSE" && p.courseId).map((p) => p.courseId!)
    ),
  ]
  const digitalIds = [
    ...new Set(
      payments
        .filter((p) => p.type === "DIGITAL_PRODUCT" && p.entityId)
        .map((p) => p.entityId!)
    ),
  ]
  const orderIds = [
    ...new Set(
      payments
        .filter((p) => p.type === "PHYSICAL_ORDER" && p.entityId)
        .map((p) => p.entityId!)
    ),
  ]

  const [courses, digital, orders] = await Promise.all([
    courseIds.length
      ? prisma.course.findMany({
          where: { id: { in: courseIds } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    digitalIds.length
      ? prisma.digitalProduct.findMany({
          where: { id: { in: digitalIds } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    orderIds.length
      ? prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: { id: true, orderCode: true },
        })
      : Promise.resolve([]),
  ])

  const courseMap = new Map(courses.map((c) => [c.id, c.title]))
  const digitalMap = new Map(digital.map((p) => [p.id, p.title]))
  const orderMap = new Map(orders.map((o) => [o.id, o.orderCode]))

  return payments.map((payment) => {
    switch (payment.type) {
      case "COURSE":
        return courseMap.get(payment.courseId!) || "Course"
      case "DIGITAL_PRODUCT":
        return digitalMap.get(payment.entityId!) || "Digital product"
      case "PHYSICAL_ORDER": {
        const code = orderMap.get(payment.entityId!)
        return code ? `Order ${code}` : "Physical order"
      }
      case "SUBSCRIPTION":
        return `Subscription ${payment.entityId || "plan"}`
      case "MENTOR_BOOKING":
        return "Mentor session"
      default:
        return payment.type
    }
  })
}

export async function listAdminPayments(
  pagination: PaginationParams,
  filters?: { search?: string; status?: string; from?: string; to?: string }
) {
  const { page, pageSize, skip } = pagination
  const where: Prisma.PaymentRecordWhereInput = {}

  if (filters?.status && filters.status !== "all") {
    where.status = filters.status as Prisma.PaymentRecordWhereInput["status"]
  } else {
    where.status = { in: ["COMPLETED", "REFUNDED"] }
  }

  if (filters?.from || filters?.to) {
    where.createdAt = {}
    if (filters.from) where.createdAt.gte = new Date(filters.from)
    if (filters.to) {
      const end = new Date(filters.to)
      end.setHours(23, 59, 59, 999)
      where.createdAt.lte = end
    }
  }

  if (filters?.search) {
    const q = filters.search
    where.AND = [
      {
        OR: [
          { tranId: { contains: q, mode: "insensitive" } },
          { paymentRef: { contains: q, mode: "insensitive" } },
          { referenceCode: { contains: q, mode: "insensitive" } },
          { customerTrxId: { contains: q, mode: "insensitive" } },
          { senderNumber: { contains: q, mode: "insensitive" } },
          { student: { firstName: { contains: q, mode: "insensitive" } } },
          { student: { lastName: { contains: q, mode: "insensitive" } } },
          { student: { user: { email: { contains: q, mode: "insensitive" } } } },
        ],
      },
    ]
  }

  const [payments, total] = await Promise.all([
    prisma.paymentRecord.findMany({
      where,
      include: {
        student: { include: { user: { select: { email: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.paymentRecord.count({ where }),
  ])

  const items = payments.map((p) => {
    const meta = (p.metadata as { refund?: Record<string, unknown> } | null) || {}
    return {
      id: p.id,
      type: p.type,
      status: p.status,
      amount: Number(p.amount),
      currency: p.currency,
      gateway: p.gateway,
      studentName: `${p.student.firstName} ${p.student.lastName}`,
      studentEmail: p.student.user.email,
      createdAt: p.createdAt.toISOString(),
      paymentRef: p.paymentRef,
      tranId: p.tranId,
      referenceCode: p.referenceCode,
      senderNumber: p.senderNumber,
      customerTrxId: p.customerTrxId,
      entityLabel: "",
      refund: meta.refund
        ? {
            type: String(meta.refund.type || "full"),
            amount: Number(meta.refund.amount || p.amount),
            reason: meta.refund.reason ? String(meta.refund.reason) : undefined,
            refundedAt: String(meta.refund.refundedAt || ""),
          }
        : null,
    }
  })

  const labels = await resolveEntityLabelsBatch(payments)
  for (let i = 0; i < items.length; i++) {
    items[i].entityLabel = labels[i]
  }

  return paginatedResult(items, total, page, pageSize)
}

async function revokeCourseAccess(studentId: string, courseId: string) {
  await prisma.certificate.updateMany({
    where: { studentId, courseId, isRevoked: false },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: "Payment refunded",
    },
  })
  await prisma.enrollment.deleteMany({
    where: { studentId, courseId },
  })
  await revokeStudentIdIfNoEnrollments(studentId)
}

async function revokeDigitalProductAccess(studentId: string, productId: string) {
  await prisma.productPurchase.deleteMany({
    where: { studentId, productId },
  })
}

async function revokePhysicalOrderAccess(orderId: string) {
  await cancelOrderWithRestock(orderId)
}

async function revokeSubscriptionAccess(studentId: string) {
  await prisma.subscription.upsert({
    where: { studentId },
    create: {
      studentId,
      plan: "FREE",
      status: "CANCELLED",
    },
    update: {
      plan: "FREE",
      status: "CANCELLED",
      expiresAt: null,
      cancelAtPeriodEnd: false,
      cancelledAt: new Date(),
      paymentRef: null,
    },
  })
}

async function revokeMentorBookingAccess(studentId: string, slotId: string) {
  const booking = await prisma.mentorBooking.findFirst({
    where: { studentId, slotId },
    orderBy: { createdAt: "desc" },
  })
  if (!booking) return

  await prisma.$transaction(async (tx) => {
    await tx.mentorBooking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    })
    await tx.mentorSlot.update({
      where: { id: slotId },
      data: { isBooked: false },
    })
  })
}

async function revokePaymentAccess(payment: NonNullable<PaymentRow>) {
  switch (payment.type) {
    case "COURSE":
      if (payment.courseId) {
        await revokeCourseAccess(payment.studentId, payment.courseId)
      }
      break
    case "DIGITAL_PRODUCT":
      if (payment.entityId) {
        await revokeDigitalProductAccess(payment.studentId, payment.entityId)
      }
      break
    case "PHYSICAL_ORDER":
      if (payment.entityId) {
        await revokePhysicalOrderAccess(payment.entityId)
      }
      break
    case "SUBSCRIPTION":
      await revokeSubscriptionAccess(payment.studentId)
      break
    case "MENTOR_BOOKING":
      if (payment.entityId) {
        await revokeMentorBookingAccess(payment.studentId, payment.entityId)
      }
      break
  }
}

export async function processRefund(
  paymentId: string,
  input: RefundInput,
  adminUserId?: string
) {
  const payment = await prisma.paymentRecord.findUnique({
    where: { id: paymentId },
    include: {
      student: { include: { user: { select: { email: true, id: true } } } },
    },
  })

  if (!payment) {
    throw Object.assign(new Error("Payment not found"), { code: "NOT_FOUND" })
  }

  if (payment.status !== "COMPLETED") {
    throw Object.assign(new Error("Only completed payments can be refunded"), {
      code: "INVALID_STATE",
    })
  }

  const totalAmount = Number(payment.amount)
  const refundAmount =
    input.type === "full" ? totalAmount : Number(input.amount ?? 0)

  if (refundAmount <= 0 || refundAmount > totalAmount) {
    throw Object.assign(new Error("Invalid refund amount"), { code: "INVALID_AMOUNT" })
  }

  const existingMeta =
    (payment.metadata as Record<string, unknown> | null) || {}
  const refundMeta = {
    type: input.type,
    amount: refundAmount,
    reason: input.reason?.trim() || null,
    refundedAt: new Date().toISOString(),
    refundedBy: adminUserId || null,
  }

  if (input.type === "full") {
    await revokePaymentAccess(payment)
    await prisma.paymentRecord.update({
      where: { id: paymentId },
      data: {
        status: "REFUNDED",
        metadata: { ...existingMeta, refund: refundMeta },
      },
    })
  } else {
    await prisma.paymentRecord.update({
      where: { id: paymentId },
      data: {
        metadata: { ...existingMeta, refund: refundMeta },
      },
    })
  }

  const [entityLabel] = await resolveEntityLabelsBatch([payment])
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"

  await sendRefundConfirmationEmail(
    payment.student.user.email,
    payment.student.firstName,
    entityLabel,
    refundAmount,
    payment.currency,
    input.type
  )

  await createNotification(
    payment.student.user.id,
    "PAYMENT_REFUNDED",
    input.type === "full" ? "Payment Refunded" : "Partial Refund Issued",
    `${entityLabel}: ${payment.currency === "BDT" ? "৳" : "$"}${refundAmount} refunded`,
    `${frontendUrl}/dashboard/settings`
  )

  return {
    paymentId,
    type: input.type,
    amount: refundAmount,
    currency: payment.currency,
    status: input.type === "full" ? "REFUNDED" : "COMPLETED",
    entityLabel,
  }
}
