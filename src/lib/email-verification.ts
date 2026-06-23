import type { Role } from "@fxprime/types"

const STAFF_ROLES: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "INSTRUCTOR",
]

export function isEmailVerificationEnforced(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION === "true"
}

export function bypassesEmailVerification(role: Role): boolean {
  return STAFF_ROLES.includes(role)
}
