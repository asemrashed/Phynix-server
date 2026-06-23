import type {
  ManualPaymentDetails,
  ManualPaymentProvider,
  SubmitManualPaymentProofRequest,
} from "@fxprime/types"
import { prisma } from "../lib/prisma"
import {
  generateReferenceCode,
  isManualPaymentGateway,
  normalizeBdPhone,
  normalizeTrxId,
} from "../lib/manual-payment"
import { paymentBaseUrl } from "./payment-core.service"
import { getManualPaymentMethod } from "./manual-payment-method.service"
import { createNotification } from "./notification.service"

const MANUAL_PAYMENT_TTL_HOURS = 48

async function uniqueReferenceCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const referenceCode = generateReferenceCode()
    const existing = await prisma.paymentRecord.findUnique({ where: { referenceCode } })
    if (!existing) return referenceCode
  }
  throw Object.assign(new Error("Could not generate payment reference"), { code: "INTERNAL" })
}

async function resolveEntityLabel(payment: {
  type: string
  courseId: string | null
  entityId: string | null
}): Promise<string> {
  switch (payment.type) {
    case "COURSE": {
      if (!payment.courseId) return "Course"
      const course = await prisma.course.findUnique({
        where: { id: payment.courseId },
        select: { title: true },
      })
      return course?.title || "Course"
    }
    case "DIGITAL_PRODUCT": {
      if (!payment.entityId) return "Digital product"
      const product = await prisma.digitalProduct.findUnique({
        where: { id: payment.entityId },
        select: { title: true },
      })
      return product?.title || "Digital product"
    }
    case "PHYSICAL_ORDER": {
      if (!payment.entityId) return "Physical order"
      const order = await prisma.order.findUnique({
        where: { id: payment.entityId },
        select: { orderCode: true },
      })
      return order ? `Order ${order.orderCode}` : "Physical order"
    }
    case "SUBSCRIPTION":
      return `Subscription ${payment.entityId || "plan"}`
    case "MENTOR_BOOKING":
      return "Mentor session"
    default:
      return payment.type
  }
}

export async function createManualPaymentCheckout(paymentId: string) {
  const frontendUrl = paymentBaseUrl()
  return {
    paymentId,
    checkoutUrl: `${frontendUrl}/checkout/manual?paymentId=${paymentId}`,
    manual: true as const,
  }
}

export async function enrichManualPaymentRecord(paymentId: string) {
  const referenceCode = await uniqueReferenceCode()
  const expiresAt = new Date(Date.now() + MANUAL_PAYMENT_TTL_HOURS * 60 * 60 * 1000)

  return prisma.paymentRecord.update({
    where: { id: paymentId },
    data: { referenceCode, expiresAt },
  })
}

export async function getManualPaymentDetails(
  paymentId: string,
  studentId?: string
): Promise<ManualPaymentDetails> {
  const payment = await prisma.paymentRecord.findUnique({ where: { id: paymentId } })
  if (!payment) throw Object.assign(new Error("Payment not found"), { code: "NOT_FOUND" })
  if (studentId && payment.studentId !== studentId) {
    throw Object.assign(new Error("Payment not found"), { code: "NOT_FOUND" })
  }
  if (!isManualPaymentGateway(payment.gateway)) {
    throw Object.assign(new Error("Not a manual payment"), { code: "INVALID_GATEWAY" })
  }

  if (
    payment.expiresAt &&
    payment.expiresAt < new Date() &&
    (payment.status === "PENDING" || payment.status === "REJECTED")
  ) {
    await prisma.paymentRecord.update({
      where: { id: paymentId },
      data: { status: "EXPIRED" },
    })
    payment.status = "EXPIRED"
  }

  const method = await getManualPaymentMethod(payment.gateway)
  if (!method) throw Object.assign(new Error("Payment method not found"), { code: "NOT_FOUND" })

  return {
    id: payment.id,
    referenceCode: payment.referenceCode || payment.tranId || payment.id.slice(0, 8).toUpperCase(),
    amount: Number(payment.amount),
    currency: payment.currency,
    gateway: payment.gateway,
    status: payment.status,
    merchantNumber: method.merchantNumber,
    merchantName: method.merchantName,
    qrImageUrl: method.qrImageUrl,
    instructions: method.instructions,
    expiresAt: payment.expiresAt?.toISOString() ?? null,
    entityLabel: await resolveEntityLabel(payment),
    senderNumber: payment.senderNumber,
    customerTrxId: payment.customerTrxId,
    rejectReason: payment.rejectReason,
    submittedAt: payment.submittedAt?.toISOString() ?? null,
    proofUrl: payment.proofUrl,
  }
}

export async function submitManualPaymentProof(
  paymentId: string,
  studentId: string,
  input: SubmitManualPaymentProofRequest
) {
  const payment = await prisma.paymentRecord.findUnique({ where: { id: paymentId } })
  if (!payment || payment.studentId !== studentId) {
    throw Object.assign(new Error("Payment not found"), { code: "NOT_FOUND" })
  }
  if (!isManualPaymentGateway(payment.gateway)) {
    throw Object.assign(new Error("Not a manual payment"), { code: "INVALID_GATEWAY" })
  }
  if (payment.status === "AWAITING_VERIFICATION") {
    throw Object.assign(new Error("Proof already submitted"), { code: "ALREADY_SUBMITTED" })
  }
  if (payment.status === "COMPLETED") {
    throw Object.assign(new Error("Payment already completed"), { code: "ALREADY_COMPLETED" })
  }
  if (payment.status === "EXPIRED") {
    throw Object.assign(new Error("Payment expired"), { code: "PAYMENT_EXPIRED" })
  }
  if (payment.expiresAt && payment.expiresAt < new Date()) {
    await prisma.paymentRecord.update({ where: { id: paymentId }, data: { status: "EXPIRED" } })
    throw Object.assign(new Error("Payment expired"), { code: "PAYMENT_EXPIRED" })
  }

  const senderNumber = normalizeBdPhone(input.senderNumber)
  const customerTrxId = normalizeTrxId(input.customerTrxId)

  const duplicate = await prisma.paymentRecord.findFirst({
    where: {
      customerTrxId,
      id: { not: paymentId },
      status: { in: ["AWAITING_VERIFICATION", "COMPLETED"] },
    },
  })
  if (duplicate) {
    throw Object.assign(new Error("Transaction ID already used"), { code: "DUPLICATE_TRX" })
  }

  const updated = await prisma.paymentRecord.update({
    where: { id: paymentId },
    data: {
      senderNumber,
      customerTrxId,
      proofUrl: input.proofUrl?.trim() || null,
      submittedAt: new Date(),
      status: "AWAITING_VERIFICATION",
    },
    include: { student: { include: { user: true } } },
  })

  const installment = await prisma.installmentPayment.findFirst({
    where: { paymentRecordId: paymentId },
  })
  if (installment) {
    await prisma.installmentPayment.update({
      where: { id: installment.id },
      data: { status: "AWAITING_VERIFICATION" },
    })
  }

  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
    select: { id: true },
  })
  for (const admin of admins) {
    await createNotification(
      admin.id,
      "PAYMENT_REVIEW",
      "Payment proof submitted",
      `${updated.student.firstName} submitted ${payment.gateway.toUpperCase()} payment (${customerTrxId})`,
      "/admin/payments/pending"
    )
  }

  return getManualPaymentDetails(paymentId, studentId)
}

export async function expireStaleManualPayments() {
  const result = await prisma.paymentRecord.updateMany({
    where: {
      gateway: { in: ["bkash", "nagad"] },
      status: { in: ["PENDING", "REJECTED"] },
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  })
  return result.count
}

export type { ManualPaymentProvider }
