import type {
  CreatePaymentSessionRequest,
  PaymentGateway,
  PaymentSessionResponse,
  PlanType,
  ConsultationType,
} from "@fxprime/types"
import { getConsultationLabel } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { AppError } from "../lib/errors"
import { resolveChargedAmount } from "../lib/payment-amount"
import { getPlanPrice } from "./subscription.service"
import {
  createPaymentSession,
  createSSLCommerzPayment,
} from "./payment-core.service"
import {
  resolveCheckoutGateway,
} from "./payment-gateway.service"

export type CreatePaymentInput =
  | {
      kind: "course"
      courseId: string
      gateway?: PaymentGateway
      currency?: "BDT"
    }
  | { kind: "digital_product"; productId: string; gateway?: PaymentGateway }
  | { kind: "subscription"; plan: Exclude<PlanType, "FREE">; gateway?: PaymentGateway; sessionId?: string }
  | { kind: "mentor_booking"; slotId: string; consultationType?: ConsultationType; gateway?: PaymentGateway }
  | {
      kind: "physical_order"
      items: { productId: string; quantity: number }[]
      shippingAddress: Record<string, string>
      gateway?: PaymentGateway
    }

export interface PaymentCustomer {
  name: string
  email: string
  phone?: string
}

async function resolveGateway(requested?: PaymentGateway): Promise<PaymentGateway> {
  try {
    return await resolveCheckoutGateway(requested)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NO_PAYMENT_GATEWAY") {
      throw new AppError("NO_PAYMENT_GATEWAY", "No payment gateway is available", 503)
    }
    if (code === "GATEWAY_DISABLED") {
      throw new AppError("GATEWAY_DISABLED", "Payment gateway is disabled", 400)
    }
    if (code === "GATEWAY_NOT_CONFIGURED") {
      throw new AppError("GATEWAY_NOT_CONFIGURED", "Payment gateway is not configured", 503)
    }
    throw err
  }
}

export async function createPayment(
  studentId: string,
  userId: string,
  input: CreatePaymentInput,
  customer: PaymentCustomer
): Promise<{ paymentId?: string; sessionId?: string; checkoutUrl: string; tranId?: string | null; gateway?: string }> {
  switch (input.kind) {
    case "course": {
      const gateway = await resolveGateway(input.gateway)
      const session = await createPaymentSession(
        studentId,
        {
          courseId: input.courseId,
          gateway,
        } satisfies CreatePaymentSessionRequest,
        customer
      )
      return {
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
        gateway: session.gateway,
      }
    }

    case "digital_product": {
      const product = await prisma.digitalProduct.findUnique({ where: { id: input.productId } })
      if (!product || !product.isActive) {
        throw new AppError("NOT_FOUND", "Product not found", 404)
      }
      const price = Number(product.price)
      if (price <= 0) {
        throw new AppError("FREE_PRODUCT", "Use direct purchase for free products", 400)
      }
      const gateway = await resolveGateway(input.gateway)
      const { amount, currency } = resolveChargedAmount(price, product.currency, gateway)
      return createSSLCommerzPayment({
        studentId,
        userId,
        type: "DIGITAL_PRODUCT",
        amount,
        currency,
        gateway,
        productName: product.title,
        entityId: product.id,
        metadata: { baseAmount: price, baseCurrency: product.currency },
        customer,
      })
    }

    case "subscription": {
      const priceBdt = getPlanPrice(input.plan)
      const gateway = await resolveGateway(input.gateway)
      const { amount, currency } = resolveChargedAmount(priceBdt, "BDT", gateway)
      return createSSLCommerzPayment({
        studentId,
        userId,
        type: "SUBSCRIPTION",
        amount,
        currency,
        gateway,
        productName: `${input.plan} Plan`,
        entityId: input.plan,
        metadata: {
          baseAmount: priceBdt,
          baseCurrency: "BDT",
          ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        },
        customer,
      })
    }

    case "mentor_booking": {
      const slot = await prisma.mentorSlot.findUnique({
        where: { id: input.slotId },
        include: { mentor: true },
      })
      if (!slot || slot.isBooked) {
        throw new AppError("NOT_FOUND", "Slot not available", 404)
      }
      const gateway = await resolveGateway(input.gateway)
      const baseAmount = Number(slot.mentor.pricePerSession)
      const { amount, currency } = resolveChargedAmount(baseAmount, slot.mentor.currency, gateway)
      const consultationLabel = getConsultationLabel(input.consultationType)
      const productName = consultationLabel
        ? `${consultationLabel}: ${slot.mentor.displayName}`
        : `Mentor: ${slot.mentor.displayName}`
      return createSSLCommerzPayment({
        studentId,
        userId,
        type: "MENTOR_BOOKING",
        amount,
        currency,
        gateway,
        productName,
        entityId: input.slotId,
        metadata: {
          baseAmount,
          baseCurrency: slot.mentor.currency,
          ...(input.consultationType ? { consultationType: input.consultationType } : {}),
        },
        customer,
      })
    }

    case "physical_order": {
      const { createPendingPhysicalOrderPayment } = await import("./payment.service")
      const gateway = await resolveGateway(input.gateway)
      return createPendingPhysicalOrderPayment(
        studentId,
        userId,
        input.items,
        input.shippingAddress,
        gateway
      )
    }

    default: {
      const _exhaustive: never = input
      throw new AppError("INVALID_REQUEST", "Invalid payment request", 400)
    }
  }
}

export type { PaymentSessionResponse }
