import type { PaymentGateway } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import {
  createSSLCommerzPayment,
  createPaymentSession,
  getPaymentAmountBDT,
} from "./payment-core.service"
import { getGatewayCurrency } from "./payment-gateway.service"
import { fulfillPayment } from "./payment-fulfillment.service"
import {
  handleSSLCommerzIPN,
  handleSSLCommerzSuccessRedirect,
  initSSLCommerzRedirect,
} from "./payment-sslcommerz-handlers.service"

export type { PaymentType, CreateGenericPaymentInput } from "./payment-types"

export { createPayment } from "./payment-checkout.service"

export {
  createPaymentSession,
  createSSLCommerzPayment,
  getPaymentAmountBDT,
} from "./payment-core.service"

export { fulfillPayment } from "./payment-fulfillment.service"

export {
  handleSSLCommerzIPN,
  handleSSLCommerzSuccessRedirect,
  initSSLCommerzRedirect,
} from "./payment-sslcommerz-handlers.service"

export async function getPaymentStatus(paymentId: string, studentId?: string) {
  const payment = await prisma.paymentRecord.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      status: true,
      type: true,
      amount: true,
      currency: true,
      gateway: true,
      studentId: true,
      referenceCode: true,
      rejectReason: true,
      submittedAt: true,
      metadata: true,
    },
  })
  if (!payment) throw Object.assign(new Error("Payment not found"), { code: "NOT_FOUND" })
  if (studentId && payment.studentId !== studentId) {
    throw Object.assign(new Error("Payment not found"), { code: "NOT_FOUND" })
  }
  const meta = payment.metadata as { sessionId?: string } | null
  return {
    id: payment.id,
    status: payment.status,
    type: payment.type,
    amount: Number(payment.amount),
    currency: payment.currency,
    gateway: payment.gateway,
    referenceCode: payment.referenceCode,
    rejectReason: payment.rejectReason,
    submittedAt: payment.submittedAt?.toISOString() ?? null,
    sessionId: meta?.sessionId ?? null,
  }
}

export async function confirmPayment(paymentId: string, paymentRef: string, _userId: string) {
  return fulfillPayment(paymentId, paymentRef)
}

export async function simulatePaymentSuccess(paymentId: string, userId: string) {
  const payment = await prisma.paymentRecord.findUnique({ where: { id: paymentId } })
  if (!payment) {
    throw Object.assign(new Error("Payment not found"), { code: "NOT_FOUND" })
  }

  const student = await prisma.student.findUnique({ where: { userId } })
  if (!student || payment.studentId !== student.id) {
    throw Object.assign(new Error("Payment not found"), { code: "NOT_FOUND" })
  }

  return confirmPayment(paymentId, `sim_${Date.now()}`, userId)
}

export async function createPendingPhysicalOrderPayment(
  studentId: string,
  userId: string,
  items: { productId: string; quantity: number }[],
  shippingAddress: Record<string, string>,
  gateway: PaymentGateway = "sslcommerz"
) {
  const productIds = items.map((i) => i.productId)
  const products = await prisma.physicalProduct.findMany({
    where: { id: { in: productIds }, isActive: true },
  })

  if (products.length !== productIds.length) {
    throw Object.assign(new Error("Product not found"), { code: "NOT_FOUND" })
  }

  type PhysicalProduct = (typeof products)[number]
  const productMap = new Map<string, PhysicalProduct>(products.map((p) => [p.id, p]))
  let subtotal = 0

  for (const item of items) {
    const product = productMap.get(item.productId)
    if (!product) {
      throw Object.assign(new Error("Product not found"), { code: "NOT_FOUND" })
    }
    if (product.stock < item.quantity) {
      throw Object.assign(new Error(`Insufficient stock for ${product.name}`), {
        code: "OUT_OF_STOCK",
      })
    }
    subtotal += Number(product.price) * item.quantity
  }

  const shippingFee = subtotal >= 1000 ? 0 : 80
  const total = subtotal + shippingFee

  const counter = await prisma.orderIdCounter.update({
    where: { id: "global" },
    data: { count: { increment: 1 } },
  })
  const orderCode = `FXP-${String(counter.count).padStart(6, "0")}`

  const currency = getGatewayCurrency(gateway)

  const order = await prisma.order.create({
    data: {
      orderCode,
      studentId,
      subtotal,
      shippingFee,
      total,
      currency,
      shippingAddress,
      status: "PENDING",
      gateway,
      items: {
        create: items.map((item) => {
          const product = productMap.get(item.productId)!
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: product.price,
          }
        }),
      },
    },
  })

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  })

  return createSSLCommerzPayment({
    studentId,
    userId,
    type: "PHYSICAL_ORDER",
    amount: total,
    currency,
    gateway,
    productName: `Order ${orderCode}`,
    entityId: order.id,
    metadata: { orderCode, items, shippingAddress },
    customer: {
      name: shippingAddress.name || `${student!.firstName} ${student!.lastName}`,
      email: student!.user.email,
      phone: shippingAddress.phone,
    },
  })
}
