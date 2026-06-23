import type { CreatePaymentSessionRequest, PaymentSessionResponse } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { isManualPaymentGateway } from "../lib/manual-payment"
import {
  initSSLCommerzSession,
  isSSLCommerzConfigured,
  convertToBDT,
} from "./sslcommerz.service"
import { resolveChargedAmount } from "../lib/payment-amount"
import type { CreateGenericPaymentInput } from "./payment-types"
import { enrichManualPaymentRecord } from "./manual-payment.service"
import { resolveCheckoutGateway } from "./payment-gateway.service"

export const paymentBaseUrl = () => process.env.FRONTEND_URL || "http://localhost:3000"

export async function createPaymentRecord(input: CreateGenericPaymentInput) {
  const tranId = `FXP${Date.now()}${Math.random().toString(36).slice(2, 6)}`

  return prisma.paymentRecord.create({
    data: {
      studentId: input.studentId,
      type: input.type,
      courseId: input.courseId,
      entityId: input.entityId,
      metadata: input.metadata as object,
      amount: input.amount,
      currency: input.currency,
      gateway: input.gateway,
      status: "PENDING",
      tranId,
    },
  })
}

interface CheckoutOptions {
  ssl?: Parameters<typeof initSSLCommerzSession>[0]
}

export async function buildCheckoutUrl(
  paymentId: string,
  gateway: string,
  options: CheckoutOptions = {}
): Promise<string> {
  if (isManualPaymentGateway(gateway)) {
    await enrichManualPaymentRecord(paymentId)
    return `${paymentBaseUrl()}/checkout/manual?paymentId=${paymentId}`
  }
  if (gateway === "sslcommerz" && isSSLCommerzConfigured() && options.ssl) {
    return initSSLCommerzSession(options.ssl)
  }
  return `${paymentBaseUrl()}/checkout?paymentId=${paymentId}&gateway=${gateway}&dev=1`
}

export async function createSSLCommerzPayment(input: CreateGenericPaymentInput) {
  const payment = await createPaymentRecord(input)

  const checkoutUrl = await buildCheckoutUrl(payment.id, input.gateway, {
    ssl: {
      tranId: payment.tranId!,
      totalAmount: input.amount,
      currency: input.currency,
      productName: input.productName,
      cusName: input.customer.name,
      cusEmail: input.customer.email,
      cusPhone: input.customer.phone || "01700000000",
    },
  })

  return {
    paymentId: payment.id,
    checkoutUrl,
    tranId: payment.tranId,
    gateway: input.gateway,
    manual: isManualPaymentGateway(input.gateway),
  }
}

export async function createPaymentSession(
  studentId: string,
  data: CreatePaymentSessionRequest,
  customer?: { name: string; email: string; phone?: string }
): Promise<PaymentSessionResponse> {
  const course = await prisma.course.findUnique({ where: { id: data.courseId } })
  if (!course) throw Object.assign(new Error("Course not found"), { code: "NOT_FOUND" })

  const price = Number(course.price)
  if (price <= 0) {
    throw Object.assign(new Error("Course is free"), { code: "FREE_COURSE" })
  }

  const existing = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId: data.courseId } },
  })
  if (existing) {
    throw Object.assign(new Error("Already enrolled"), { code: "ALREADY_ENROLLED" })
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  })

  const gateway = await resolveCheckoutGateway(data.gateway)
  const baseCurrency = course.currency
  const { amount, currency } = resolveChargedAmount(price, baseCurrency, gateway)

  const payment = await createPaymentRecord({
    studentId,
    userId: student!.userId,
    type: "COURSE",
    amount,
    currency,
    gateway,
    productName: course.title,
    courseId: data.courseId,
    metadata: { baseAmount: price, baseCurrency },
    customer: customer || {
      name: `${student!.firstName} ${student!.lastName}`,
      email: student!.user.email,
      phone: student!.phone || undefined,
    },
  })

  const custEmail = customer?.email || student!.user.email
  const checkoutUrl = await buildCheckoutUrl(payment.id, gateway, {
    ssl: {
      tranId: payment.tranId!,
      totalAmount: amount,
      currency,
      productName: course.title,
      cusName: customer?.name || `${student!.firstName} ${student!.lastName}`,
      cusEmail: custEmail,
      cusPhone: customer?.phone || student!.phone || "01700000000",
    },
  })

  return {
    sessionId: payment.id,
    gateway,
    checkoutUrl,
    paymentId: payment.id,
    manual: isManualPaymentGateway(gateway),
  }
}

export function getPaymentAmountBDT(amount: number, currency: string): number {
  return convertToBDT(amount, currency)
}
