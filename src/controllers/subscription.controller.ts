import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  getStudentSubscription,
  subscribeToPlan,
  getSubscriptionPlans,
  cancelSubscriptionAtPeriodEnd,
  reactivateSubscription,
} from "../services/subscription.service"
import { getPremiumAccessInfo } from "../services/access-control.service"
import { sendSuccess, sendError } from "../lib/response"
import { getStudentId } from "../lib/student"
import { prisma } from "../lib/prisma"
import { sendSubscriptionCancelledEmail } from "../services/email.service"

export async function getMySubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const sub = await getStudentSubscription(studentId)
    const access = await getPremiumAccessInfo(studentId)
    return sendSuccess(res, {
      ...sub,
      hasPremiumAccess: access.hasPremiumAccess,
    })
  } catch (err) {
    next(err)
  }
}

const subscribeSchema = z.object({
  plan: z.enum(["BASIC", "PRO", "LIFETIME"]),
  paymentRef: z.string().optional(),
})

export async function subscribe(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const body = subscribeSchema.parse(req.body)
    const sub = await subscribeToPlan(studentId, body.plan, body.paymentRef)
    const full = await getStudentSubscription(studentId)
    return sendSuccess(res, full)
  } catch (err) {
    next(err)
  }
}

export async function cancelSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    try {
      const sub = await cancelSubscriptionAtPeriodEnd(studentId)
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: { user: { select: { email: true } } },
      })
      if (student && sub.expiresAt) {
        await sendSubscriptionCancelledEmail(
          student.user.email,
          student.firstName,
          sub.plan,
          sub.expiresAt.toISOString()
        )
      }
      const full = await getStudentSubscription(studentId)
      const access = await getPremiumAccessInfo(studentId)
      return sendSuccess(res, { ...full, hasPremiumAccess: access.hasPremiumAccess })
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === "ALREADY_CANCELLED") {
        return sendError(res, code, (err as Error).message, 409)
      }
      if (code === "INVALID_STATE") {
        return sendError(res, code, (err as Error).message, 400)
      }
      throw err
    }
  } catch (err) {
    next(err)
  }
}

export async function reactivateSubscriptionHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    try {
      await reactivateSubscription(studentId)
      const full = await getStudentSubscription(studentId)
      const access = await getPremiumAccessInfo(studentId)
      return sendSuccess(res, { ...full, hasPremiumAccess: access.hasPremiumAccess })
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === "INVALID_STATE") {
        return sendError(res, code, (err as Error).message, 400)
      }
      throw err
    }
  } catch (err) {
    next(err)
  }
}

export async function getPlans(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, getSubscriptionPlans())
  } catch (err) {
    next(err)
  }
}
