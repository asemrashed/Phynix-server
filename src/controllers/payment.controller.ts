import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  simulatePaymentSuccess,
  handleSSLCommerzIPN,
  handleSSLCommerzSuccessRedirect,
  initSSLCommerzRedirect,
  fulfillPayment,
  getPaymentStatus,
} from "../services/payment.service"
import { createPayment } from "../services/payment-checkout.service"
import { getPublicPaymentConfig } from "../services/payment-gateway.service"
import { paymentGatewaySchema } from "../lib/payment-gateways"
import { parseConsultationTypeParam } from "../lib/consultation"
import { sendSuccess, sendError } from "../lib/response"
import { prisma } from "../lib/prisma"
import { param } from "../lib/params"
import { getStudentId } from "../lib/student"

const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000"

export async function createSession(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      courseId: z.string().uuid(),
      gateway: paymentGatewaySchema.optional(),
      currency: z.literal("BDT").optional(),
    })
    const data = schema.parse(req.body)

    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }

    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
      include: { user: true },
    })
    if (!student) {
      return sendError(res, "NOT_FOUND", "Student not found", 404)
    }

    const session = await createPayment(
      student.id,
      student.userId,
      {
        kind: "course",
        courseId: data.courseId,
        gateway: data.gateway,
        currency: data.currency,
      },
      {
        name: `${student.firstName} ${student.lastName}`,
        email: student.user.email,
        phone: student.phone || undefined,
      }
    )
    return sendSuccess(res, {
      sessionId: session.sessionId!,
      gateway: session.gateway!,
      checkoutUrl: session.checkoutUrl,
      paymentId: session.sessionId,
      manual: session.gateway === "bkash" || session.gateway === "nagad",
    })
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "FREE_COURSE" || error.code === "ALREADY_ENROLLED") {
      return sendError(res, error.code!, error.message, 400)
    }
    if (
      error.code === "NO_PAYMENT_GATEWAY" ||
      error.code === "GATEWAY_DISABLED" ||
      error.code === "GATEWAY_NOT_CONFIGURED"
    ) {
      return sendError(res, error.code!, error.message, error.code === "GATEWAY_DISABLED" ? 400 : 503)
    }
    next(err)
  }
}

const sslPaymentSchema = z.object({
  type: z.enum(["digital_product", "subscription", "mentor_booking", "physical_order"]),
  gateway: paymentGatewaySchema.optional(),
  productId: z.string().optional(),
  plan: z.enum(["BASIC", "PRO", "LIFETIME"]).optional(),
  sessionId: z.string().uuid().optional(),
  slotId: z.string().optional(),
  consultationType: z.enum(["CAREER", "STUDY_ABROAD", "TRADING", "BUSINESS"]).optional(),
  items: z
    .array(z.object({ productId: z.string(), quantity: z.number().int().min(1) }))
    .optional(),
  shippingAddress: z
    .object({
      name: z.string(),
      phone: z.string(),
      address: z.string(),
      city: z.string(),
      postalCode: z.string().optional(),
    })
    .optional(),
})

export async function createSSLPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student not found", 404)

    const body = sslPaymentSchema.parse(req.body)
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    })
    if (!student) return sendError(res, "NOT_FOUND", "Student not found", 404)

    const customer = {
      name: `${student.firstName} ${student.lastName}`,
      email: student.user.email,
      phone: student.phone || undefined,
    }

    if (body.type === "physical_order") {
      if (!body.items?.length || !body.shippingAddress) {
        return sendError(res, "INVALID_REQUEST", "Items and shipping address required", 400)
      }
      const result = await createPayment(
        studentId,
        student.userId,
        {
          kind: "physical_order",
          items: body.items,
          shippingAddress: body.shippingAddress,
          gateway: body.gateway,
        },
        customer
      )
      return sendSuccess(res, result)
    }

    if (body.type === "digital_product" && body.productId) {
      const result = await createPayment(
        studentId,
        student.userId,
        { kind: "digital_product", productId: body.productId, gateway: body.gateway },
        customer
      )
      return sendSuccess(res, result)
    }

    if (body.type === "subscription" && body.plan) {
      const result = await createPayment(
        studentId,
        student.userId,
        {
          kind: "subscription",
          plan: body.plan,
          gateway: body.gateway,
          sessionId: body.sessionId,
        },
        customer
      )
      return sendSuccess(res, result)
    }

    if (body.type === "mentor_booking" && body.slotId) {
      const consultationType = parseConsultationTypeParam(body.consultationType)
      const result = await createPayment(
        studentId,
        student.userId,
        {
          kind: "mentor_booking",
          slotId: body.slotId,
          consultationType,
          gateway: body.gateway,
        },
        customer
      )
      return sendSuccess(res, result)
    }

    return sendError(res, "INVALID_REQUEST", "Invalid payment request", 400)
  } catch (err) {
    next(err)
  }
}

export async function simulatePayment(req: Request, res: Response, next: NextFunction) {
  try {
    if (process.env.NODE_ENV === "production") {
      return sendError(
        res,
        "NOT_AVAILABLE",
        "This endpoint is disabled in production",
        403
      )
    }

    const paymentId = param(req.params.paymentId)
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }

    const payment = await simulatePaymentSuccess(paymentId, req.user.userId)
    return sendSuccess(res, payment)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND") {
      return sendError(res, code, (err as Error).message, 404)
    }
    next(err)
  }
}

export async function sslcommerzInit(req: Request, res: Response, next: NextFunction) {
  try {
    const paymentId = param(req.params.paymentId)
    const gatewayUrl = await initSSLCommerzRedirect(paymentId)
    return res.redirect(gatewayUrl)
  } catch (err) {
    next(err)
  }
}

export async function sslcommerzIPN(req: Request, res: Response) {
  try {
    const body = req.body as Record<string, string>
    await handleSSLCommerzIPN(body)
    return res.status(200).json({ status: "OK" })
  } catch (err) {
    console.error("[SSLCommerz IPN] Error:", err)
    return res.status(200).json({ status: "FAILED" })
  }
}

function collectSSLCommerzParams(req: Request): Record<string, string> {
  const params: Record<string, string> = {}
  const sources: Array<Record<string, unknown>> = [
    (req.body as Record<string, unknown>) || {},
    req.query as Record<string, unknown>,
  ]
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined || value === null) continue
      params[key] = Array.isArray(value) ? String(value[0]) : String(value)
    }
  }
  return params
}

export async function sslcommerzSuccess(req: Request, res: Response) {
  try {
    const query = collectSSLCommerzParams(req)

    const result = await handleSSLCommerzSuccessRedirect(query)
    let redirectUrl = `${frontendUrl()}/payment/success`
    if (result.paymentId) {
      const payment = await prisma.paymentRecord.findUnique({
        where: { id: result.paymentId },
        select: { metadata: true },
      })
      const params = new URLSearchParams({ paymentId: result.paymentId })
      const sessionId = (payment?.metadata as { sessionId?: string } | null)?.sessionId
      if (sessionId) params.set("sessionId", sessionId)
      redirectUrl = `${frontendUrl()}/payment/success?${params.toString()}`
    }
    return res.redirect(redirectUrl)
  } catch (err) {
    console.error("[SSLCommerz Success] Fulfillment error:", err)
    return res.redirect(`${frontendUrl()}/payment/fail`)
  }
}

export async function sslcommerzFail(req: Request, res: Response) {
  return res.redirect(`${frontendUrl()}/payment/fail`)
}

export async function sslcommerzCancel(req: Request, res: Response) {
  return res.redirect(`${frontendUrl()}/payment/fail?cancelled=1`)
}

export async function getPaymentStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const paymentId = param(req.params.paymentId)
    let studentId: string | undefined
    if (req.user) {
      studentId = (await getStudentId(req.user.userId)) ?? undefined
    }
    const status = await getPaymentStatus(paymentId, studentId)
    return sendSuccess(res, status)
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", "Payment not found", 404)
    next(err)
  }
}

export async function getPaymentConfig(_req: Request, res: Response) {
  const config = await getPublicPaymentConfig()
  return sendSuccess(res, config)
}
