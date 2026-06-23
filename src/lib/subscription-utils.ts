import type { PlanType } from "@fxprime/types"

export const SUBSCRIPTION_GRACE_DAYS = Number(
  process.env.SUBSCRIPTION_GRACE_DAYS || 3
)

export const PLAN_DURATION_DAYS: Record<Exclude<PlanType, "FREE" | "LIFETIME">, number> = {
  BASIC: 30,
  PRO: 30,
}

export function getGraceEndsAt(expiresAt: Date | null): Date | null {
  if (!expiresAt) return null
  return new Date(
    expiresAt.getTime() + SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000
  )
}

export function computePlanExpiry(
  plan: Exclude<PlanType, "FREE">,
  baseDate?: Date | null
): Date | null {
  if (plan === "LIFETIME") return null
  const days = PLAN_DURATION_DAYS[plan]
  const base = baseDate && baseDate > new Date() ? baseDate : new Date()
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
}

export function isPaidPlanEffective(sub: {
  plan: PlanType
  status: string
  expiresAt: Date | null
}): boolean {
  if (sub.plan === "FREE") return false
  if (sub.status === "CANCELLED" || sub.status === "EXPIRED") return false

  const now = new Date()

  if (sub.plan === "LIFETIME" && sub.status === "ACTIVE") return true

  if (!sub.expiresAt) return false

  if (sub.status === "ACTIVE") {
    return sub.expiresAt >= now
  }

  if (sub.status === "GRACE") {
    const graceEnds = getGraceEndsAt(sub.expiresAt)
    return graceEnds !== null && graceEnds >= now
  }

  return false
}

export function daysUntil(date: Date | null): number | null {
  if (!date) return null
  const diff = date.getTime() - Date.now()
  return Math.ceil(diff / (24 * 60 * 60 * 1000))
}
