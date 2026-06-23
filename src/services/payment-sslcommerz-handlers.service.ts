import { prisma } from "../lib/prisma"
import {
  initSSLCommerzSession,
  isSSLCommerzConfigured,
  validateSSLCommerzPayment,
  verifySSLCommerzIPNSignature,
  sslCommerzAmountsMatch,
  convertToBDT,
} from "./sslcommerz.service"
import { fulfillPayment } from "./payment-fulfillment.service"
import { paymentBaseUrl } from "./payment-core.service"

async function completeValidatedSSLCommerzPayment(
  payment: { id: string; amount: unknown; currency: string; status: string },
  valId: string,
  validation: { tran_id: string; amount: string },
  reportedAmount?: number
) {
  if (payment.status === "COMPLETED") {
    return { paymentId: payment.id, alreadyCompleted: true as const }
  }

  const expectedAmount = convertToBDT(Number(payment.amount), payment.currency)
  const validatedAmount = Number(validation.amount)
  const compareAmount = reportedAmount ?? validatedAmount

  if (
    !sslCommerzAmountsMatch(expectedAmount, validatedAmount) ||
    !sslCommerzAmountsMatch(expectedAmount, compareAmount)
  ) {
    throw Object.assign(new Error("Amount mismatch"), { code: "AMOUNT_MISMATCH" })
  }

  await fulfillPayment(payment.id, valId)
  return { paymentId: payment.id, alreadyCompleted: false as const }
}

export async function handleSSLCommerzIPN(body: Record<string, string>) {
  const valId = body.val_id
  const tranId = body.tran_id
  const status = body.status

  if (!valId || !tranId) {
    throw Object.assign(new Error("Missing IPN fields"), { code: "INVALID_IPN" })
  }

  if (!verifySSLCommerzIPNSignature(body)) {
    throw Object.assign(new Error("Invalid IPN signature"), { code: "INVALID_IPN" })
  }

  if (status !== "VALID" && status !== "VALIDATED") {
    await prisma.paymentRecord.updateMany({
      where: { tranId },
      data: { status: "FAILED" },
    })
    return { success: false }
  }

  const validation = await validateSSLCommerzPayment(valId)

  if (tranId !== validation.tran_id) {
    throw Object.assign(new Error("tran_id mismatch"), { code: "INVALID_IPN" })
  }

  const payment = await prisma.paymentRecord.findUnique({ where: { tranId: validation.tran_id } })
  if (!payment) {
    throw Object.assign(new Error("Payment not found"), { code: "NOT_FOUND" })
  }

  const result = await completeValidatedSSLCommerzPayment(
    payment,
    valId,
    validation,
    body.amount ? Number(body.amount) : undefined
  )

  return {
    success: true,
    paymentId: result.paymentId,
    alreadyCompleted: result.alreadyCompleted,
  }
}

/** Fulfill on browser redirect when IPN cannot reach localhost (dev/sandbox fallback). */
export async function handleSSLCommerzSuccessRedirect(query: Record<string, string>) {
  const tranId = query.tran_id
  const valId = query.val_id
  const status = query.status

  if (!tranId) {
    return { paymentId: null as string | null, fulfilled: false }
  }

  const payment = await prisma.paymentRecord.findUnique({ where: { tranId } })
  if (!payment) {
    return { paymentId: null, fulfilled: false }
  }

  if (payment.status === "COMPLETED") {
    return { paymentId: payment.id, fulfilled: true }
  }

  if (status && status !== "VALID" && status !== "VALIDATED") {
    await prisma.paymentRecord.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    })
    throw Object.assign(new Error("Payment was not successful"), { code: "PAYMENT_FAILED" })
  }

  if (!valId) {
    throw Object.assign(new Error("Missing validation id"), { code: "INVALID_REDIRECT" })
  }

  const validation = await validateSSLCommerzPayment(valId)

  if (tranId !== validation.tran_id) {
    throw Object.assign(new Error("tran_id mismatch"), { code: "INVALID_REDIRECT" })
  }

  await completeValidatedSSLCommerzPayment(
    payment,
    valId,
    validation,
    query.amount ? Number(query.amount) : undefined
  )

  return { paymentId: payment.id, fulfilled: true }
}

export async function initSSLCommerzRedirect(paymentId: string): Promise<string> {
  const payment = await prisma.paymentRecord.findUnique({
    where: { id: paymentId },
    include: { student: { include: { user: true } } },
  })

  if (!payment || payment.status !== "PENDING") {
    throw Object.assign(new Error("Payment not found or already processed"), { code: "NOT_FOUND" })
  }

  if (!isSSLCommerzConfigured()) {
    return `${paymentBaseUrl()}/checkout?paymentId=${paymentId}&gateway=sslcommerz&dev=1`
  }

  const productName =
    payment.type === "COURSE"
      ? "Course Enrollment"
      : payment.type === "DIGITAL_PRODUCT"
        ? "Digital Product"
        : payment.type === "PHYSICAL_ORDER"
          ? "Physical Product Order"
          : payment.type === "SUBSCRIPTION"
            ? "Subscription Plan"
            : "Mentor Session"

  return initSSLCommerzSession({
    tranId: payment.tranId!,
    totalAmount: Number(payment.amount),
    currency: payment.currency,
    productName,
    cusName: `${payment.student.firstName} ${payment.student.lastName}`,
    cusEmail: payment.student.user.email,
    cusPhone: payment.student.phone || "01700000000",
  })
}
