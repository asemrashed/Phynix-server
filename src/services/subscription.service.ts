import type { PlanOption, PlanType } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import {
  computePlanExpiry,
  daysUntil,
  getGraceEndsAt,
  isPaidPlanEffective,
} from "../lib/subscription-utils"
import { invalidatePremiumAccessCache } from "../lib/premium-cache"

const PLAN_PRICES: Record<Exclude<PlanType, "FREE">, number> = {
  BASIC: 1650,
  PRO: 3850,
  LIFETIME: 32890,
}

type ReminderFlags = {
  sevenDay?: string
  oneDay?: string
  expired?: string
}

function parseReminderFlags(raw: unknown): ReminderFlags {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as ReminderFlags
  }
  return {}
}

export async function getStudentSubscription(studentId: string) {
  let sub = await prisma.subscription.findUnique({ where: { studentId } })
  if (!sub) {
    sub = await prisma.subscription.create({
      data: { studentId, plan: "FREE", status: "ACTIVE" },
    })
  }

  const graceEndsAt = getGraceEndsAt(sub.expiresAt)
  const effective = isPaidPlanEffective(sub)

  return {
    plan: sub.plan,
    status: sub.status,
    startedAt: sub.startedAt.toISOString(),
    expiresAt: sub.expiresAt?.toISOString() ?? null,
    graceEndsAt: graceEndsAt?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    daysUntilExpiry: daysUntil(sub.expiresAt),
    isActive: effective,
    canCancel: effective && sub.plan !== "FREE" && sub.plan !== "LIFETIME",
    canRenew:
      effective && sub.plan !== "FREE" && sub.plan !== "LIFETIME",
  }
}

export async function subscribeToPlan(
  studentId: string,
  plan: Exclude<PlanType, "FREE">,
  paymentRef?: string,
  gateway?: string
) {
  const existing = await prisma.subscription.findUnique({
    where: { studentId },
  })

  const extendFrom =
    existing?.expiresAt && existing.expiresAt > new Date()
      ? existing.expiresAt
      : null

  const expiresAt = computePlanExpiry(plan, extendFrom)

  const sub = await prisma.subscription.upsert({
    where: { studentId },
    create: {
      studentId,
      plan,
      status: "ACTIVE",
      expiresAt,
      paymentRef,
      gateway,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      reminderFlags: {},
    },
    update: {
      plan,
      status: "ACTIVE",
      expiresAt,
      paymentRef,
      gateway,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      reminderFlags: {},
      startedAt: existing?.plan === plan && extendFrom ? existing.startedAt : new Date(),
    },
  })

  await invalidatePremiumAccessCache(studentId)
  return sub
}

export async function cancelSubscriptionAtPeriodEnd(studentId: string) {
  const sub = await prisma.subscription.findUnique({ where: { studentId } })
  if (!sub || sub.plan === "FREE" || sub.plan === "LIFETIME") {
    throw Object.assign(new Error("Subscription cannot be cancelled"), {
      code: "INVALID_STATE",
    })
  }
  if (!isPaidPlanEffective(sub)) {
    throw Object.assign(new Error("No active subscription to cancel"), {
      code: "INVALID_STATE",
    })
  }
  if (sub.cancelAtPeriodEnd) {
    throw Object.assign(new Error("Cancellation already scheduled"), {
      code: "ALREADY_CANCELLED",
    })
  }

  const updated = await prisma.subscription.update({
    where: { studentId },
    data: {
      cancelAtPeriodEnd: true,
      cancelledAt: new Date(),
    },
  })

  await invalidatePremiumAccessCache(studentId)
  return updated
}

export async function reactivateSubscription(studentId: string) {
  const sub = await prisma.subscription.findUnique({ where: { studentId } })
  if (!sub || !sub.cancelAtPeriodEnd) {
    throw Object.assign(new Error("No pending cancellation to undo"), {
      code: "INVALID_STATE",
    })
  }
  if (!isPaidPlanEffective(sub)) {
    throw Object.assign(new Error("Subscription already ended"), {
      code: "INVALID_STATE",
    })
  }

  const updated = await prisma.subscription.update({
    where: { studentId },
    data: {
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    },
  })

  await invalidatePremiumAccessCache(studentId)
  return updated
}

export function getPlanPrice(plan: PlanType): number {
  if (plan === "FREE") return 0
  return PLAN_PRICES[plan]
}

export function getSubscriptionPlans(): PlanOption[] {
  return [
    {
      plan: "FREE",
      price: 0,
      currency: "BDT",
      features: ["Free courses", "Free live webinars", "Basic blog access"],
    },
    {
      plan: "BASIC",
      price: getPlanPrice("BASIC"),
      currency: "BDT",
      features: ["All free content", "Digital product discounts"],
    },
    {
      plan: "PRO",
      price: getPlanPrice("PRO"),
      currency: "BDT",
      features: ["Premium blog", "PRO live sessions", "Priority support"],
    },
    {
      plan: "LIFETIME",
      price: getPlanPrice("LIFETIME"),
      currency: "BDT",
      features: ["Everything forever", "All future courses", "PRO live sessions"],
    },
  ]
}

export function getSubscriptionReminderFlags(
  raw: unknown
): ReminderFlags {
  return parseReminderFlags(raw)
}

export { hasPremiumAccess, hasProAccess } from "./access-control.service"
