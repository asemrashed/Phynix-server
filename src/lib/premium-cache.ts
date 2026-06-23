import { invalidateCached } from "./cache"

const PREMIUM_CACHE_PREFIX = "premium:access:"

export function premiumAccessCacheKey(studentId: string): string {
  return `${PREMIUM_CACHE_PREFIX}${studentId}`
}

export async function invalidatePremiumAccessCache(studentId: string): Promise<void> {
  await invalidateCached(premiumAccessCacheKey(studentId))
}
