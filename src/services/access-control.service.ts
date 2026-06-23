import type { PlanType, Role } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { isPaidPlanEffective } from "../lib/subscription-utils"
import { getCached, setCached } from "../lib/cache"
import { premiumAccessCacheKey } from "../lib/premium-cache"

const PREMIUM_PLANS: PlanType[] = ["PRO", "LIFETIME"]
const BYPASS_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"]
const PREMIUM_CACHE_TTL = 300

export type PremiumAccessInfo = {
  plan: PlanType
  status: string
  expiresAt: string | null
  hasPremiumAccess: boolean
}

export function canBypassPremiumGate(role?: Role): boolean {
  return role ? BYPASS_ROLES.includes(role) : false
}

export function planHasPremiumAccess(plan: PlanType): boolean {
  return PREMIUM_PLANS.includes(plan)
}

export async function getPremiumAccessInfo(studentId: string): Promise<PremiumAccessInfo> {
  const cacheKey = premiumAccessCacheKey(studentId)
  const cached = await getCached<PremiumAccessInfo>(cacheKey)
  if (cached) return cached

  const sub = await prisma.subscription.findUnique({
    where: { studentId },
  })

  let result: PremiumAccessInfo

  if (!sub) {
    result = {
      plan: "FREE",
      status: "ACTIVE",
      expiresAt: null,
      hasPremiumAccess: false,
    }
  } else {
    const active = isPaidPlanEffective(sub)
    result = {
      plan: sub.plan,
      status: sub.status,
      expiresAt: sub.expiresAt?.toISOString() ?? null,
      hasPremiumAccess: active && planHasPremiumAccess(sub.plan),
    }
  }

  await setCached(cacheKey, result, PREMIUM_CACHE_TTL)
  return result
}

export async function hasPremiumAccess(
  studentId: string | null | undefined
): Promise<boolean> {
  if (!studentId) return false
  const info = await getPremiumAccessInfo(studentId)
  return info.hasPremiumAccess
}

export async function canAccessPremiumContent(options: {
  studentId?: string | null
  role?: Role
}): Promise<boolean> {
  if (canBypassPremiumGate(options.role)) return true
  return hasPremiumAccess(options.studentId)
}

/** @deprecated Use hasPremiumAccess — kept for backward compatibility */
export async function hasProAccess(studentId: string): Promise<boolean> {
  return hasPremiumAccess(studentId)
}
