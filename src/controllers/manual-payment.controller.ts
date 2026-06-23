import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import { paymentGatewaySchema } from "../lib/payment-gateways"
import {
  getManualPaymentDetails,
  submitManualPaymentProof,
} from "../services/manual-payment.service"
import {
  createInstallmentAgreement,
  createInstallmentPaymentSession,
  listCourseInstallmentPlans,
  listStudentInstallmentAgreements,
  upsertInstallmentPlan,
} from "../services/installment.service"
import {
  approveManualPayment,
  listPendingPaymentReviews,
  rejectManualPayment,
} from "../services/payment-review.service"
import { updateManualPaymentMethod } from "../services/manual-payment-method.service"
import { getUploadPublicUrl, saveImageUpload } from "../services/upload.service"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"
import { getStudentId } from "../lib/student"
import { parsePagination } from "../lib/pagination"
import { prisma } from "../lib/prisma"
import { isManualPaymentGateway } from "../lib/manual-payment"

export async function getManualPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const paymentId = param(req.params.paymentId)
    const studentId = req.user ? ((await getStudentId(req.user.userId)) ?? undefined) : undefined
    const details = await getManualPaymentDetails(paymentId, studentId)
    return sendSuccess(res, details)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
    if (code === "INVALID_GATEWAY") return sendError(res, code, (err as Error).message, 400)
    next(err)
  }
}

export async function postManualPaymentProof(req: Request, res: Response, next: NextFunction) {
  try {
    const paymentId = param(req.params.paymentId)
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student not found", 404)

    const schema = z.object({
      senderNumber: z.string().min(11).max(15),
      customerTrxId: z.string().min(4).max(32),
      proofUrl: z.string().url().optional(),
    })
    const body = schema.parse(req.body)
    const details = await submitManualPaymentProof(paymentId, studentId, body)
    return sendSuccess(res, details)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
    if (code === "INVALID_PHONE") return sendError(res, code, (err as Error).message, 400)
    if (
      code === "DUPLICATE_TRX" ||
      code === "ALREADY_SUBMITTED" ||
      code === "ALREADY_COMPLETED" ||
      code === "PAYMENT_EXPIRED"
    ) {
      return sendError(res, code!, (err as Error).message, 400)
    }
    next(err)
  }
}

export async function getCourseInstallmentPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const courseId = param(req.params.courseId)
    const plans = await listCourseInstallmentPlans(courseId)
    return sendSuccess(res, plans)
  } catch (err) {
    next(err)
  }
}

export async function postInstallmentAgreement(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student not found", 404)

    const schema = z.object({
      courseId: z.string().uuid(),
      planId: z.string().uuid(),
      gateway: paymentGatewaySchema.optional(),
    })
    const body = schema.parse(req.body)
    const result = await createInstallmentAgreement(
      studentId,
      req.user!.userId,
      body.courseId,
      body.planId,
      body.gateway
    )
    return sendSuccess(res, result)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND" || code === "ALREADY_ENROLLED" || code === "ACTIVE_AGREEMENT") {
      return sendError(res, code!, (err as Error).message, 400)
    }
    next(err)
  }
}

export async function getMyInstallments(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student not found", 404)
    const agreements = await listStudentInstallmentAgreements(studentId)
    return sendSuccess(res, agreements)
  } catch (err) {
    next(err)
  }
}

export async function postInstallmentPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const installmentPaymentId = param(req.params.installmentPaymentId)
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student not found", 404)

    const schema = z.object({
      gateway: paymentGatewaySchema.optional(),
    })
    const body = schema.parse(req.body ?? {})
    const result = await createInstallmentPaymentSession(
      studentId,
      req.user!.userId,
      installmentPaymentId,
      body.gateway
    )
    return sendSuccess(res, result)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND" || code === "ALREADY_PAID") {
      return sendError(res, code!, (err as Error).message, 400)
    }
    next(err)
  }
}

export async function getPendingPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const result = await listPendingPaymentReviews(pagination)
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function approvePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const paymentId = param(req.params.paymentId)
    const payment = await approveManualPayment(paymentId, req.user!.userId)
    return sendSuccess(res, payment)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
    if (code === "INVALID_STATUS") return sendError(res, code!, (err as Error).message, 400)
    next(err)
  }
}

export async function rejectPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const paymentId = param(req.params.paymentId)
    const schema = z.object({ reason: z.string().max(500).optional() })
    const body = schema.parse(req.body ?? {})
    const payment = await rejectManualPayment(paymentId, req.user!.userId, body.reason)
    return sendSuccess(res, payment)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
    if (code === "INVALID_STATUS") return sendError(res, code!, (err as Error).message, 400)
    next(err)
  }
}

export async function uploadPaymentQr(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file
    if (!file) {
      return sendError(res, "NO_FILE", "No file uploaded", 400)
    }

    const relativePath = await saveImageUpload(
      file.buffer,
      file.mimetype,
      file.originalname,
      "payment-qr"
    )
    const url = getUploadPublicUrl(relativePath)
    return sendSuccess(res, { url, path: relativePath })
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "INVALID_FILE_TYPE" || code === "FILE_TOO_LARGE") {
      return sendError(res, code, (err as Error).message, 400)
    }
    next(err)
  }
}

export async function uploadManualPaymentProofImage(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const paymentId = param(req.params.paymentId)
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student not found", 404)

    const payment = await prisma.paymentRecord.findUnique({ where: { id: paymentId } })
    if (!payment || payment.studentId !== studentId) {
      return sendError(res, "NOT_FOUND", "Payment not found", 404)
    }
    if (!isManualPaymentGateway(payment.gateway)) {
      return sendError(res, "INVALID_GATEWAY", "Not a manual payment", 400)
    }
    if (!["PENDING", "REJECTED"].includes(payment.status)) {
      return sendError(res, "INVALID_STATUS", "Cannot upload proof for this payment", 400)
    }

    const file = req.file
    if (!file) {
      return sendError(res, "NO_FILE", "No file uploaded", 400)
    }

    const relativePath = await saveImageUpload(
      file.buffer,
      file.mimetype,
      file.originalname,
      "payment-proof"
    )
    const url = getUploadPublicUrl(relativePath)
    return sendSuccess(res, { url, path: relativePath })
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "INVALID_FILE_TYPE" || code === "FILE_TOO_LARGE") {
      return sendError(res, code, (err as Error).message, 400)
    }
    next(err)
  }
}

export async function patchManualPaymentMethod(req: Request, res: Response, next: NextFunction) {
  try {
    const provider = param(req.params.provider) as "bkash" | "nagad"
    if (provider !== "bkash" && provider !== "nagad") {
      return sendError(res, "INVALID_REQUEST", "Invalid provider", 400)
    }

    const schema = z.object({
      enabled: z.boolean(),
      merchantNumber: z.string().min(11).max(15),
      merchantName: z.string().max(100).optional(),
      qrImageUrl: z.string().url().optional(),
      instructions: z.string().max(1000).optional(),
    })
    const body = schema.parse(req.body)
    const updated = await updateManualPaymentMethod(provider, body)
    return sendSuccess(res, updated)
  } catch (err) {
    next(err)
  }
}

export async function postInstallmentPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      courseId: z.string().uuid(),
      label: z.string().min(2).max(100),
      totalAmount: z.number().positive(),
      installmentCount: z.number().int().min(2).max(12),
      intervalDays: z.number().int().min(7).max(90).optional(),
      downPaymentPercent: z.number().int().min(10).max(90).optional(),
      isActive: z.boolean().optional(),
    })
    const body = schema.parse(req.body)
    const plan = await upsertInstallmentPlan(body)
    return sendSuccess(res, plan, 201)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
    next(err)
  }
}

export async function getInstallmentPlans(_req: Request, res: Response, next: NextFunction) {
  try {
    const { listAdminInstallmentPlans } = await import("../services/installment.service")
    const plans = await listAdminInstallmentPlans()
    return sendSuccess(res, plans)
  } catch (err) {
    next(err)
  }
}

export async function patchInstallmentPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const planId = param(req.params.planId)
    const schema = z.object({ isActive: z.boolean() })
    const body = schema.parse(req.body)
    const { setInstallmentPlanActive } = await import("../services/installment.service")
    const plan = await setInstallmentPlanActive(planId, body.isActive)
    return sendSuccess(res, plan)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
    next(err)
  }
}
