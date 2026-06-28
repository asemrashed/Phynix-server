import type { Role } from "@fxprime/types"
import { prisma } from "../lib/prisma"

const PLATFORM_INSTRUCTOR_NAME = "Phynix Education"

const INSTRUCTOR_ELIGIBLE_ROLES = ["INSTRUCTOR", "ADMIN", "SUPER_ADMIN"] as const satisfies readonly Role[]

function isInstructorEligibleRole(role: Role): role is (typeof INSTRUCTOR_ELIGIBLE_ROLES)[number] {
  return (INSTRUCTOR_ELIGIBLE_ROLES as readonly Role[]).includes(role)
}

function resolveDisplayName(
  email: string,
  role: Role,
  student?: { firstName: string; lastName: string } | null
) {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return PLATFORM_INSTRUCTOR_NAME
  if (student) return `${student.firstName} ${student.lastName}`.trim()
  return email.split("@")[0]
}

export async function provisionRoleProfile(userId: string, role: Role) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { student: true },
  })
  if (!user || !isInstructorEligibleRole(role)) return

  const displayName = resolveDisplayName(user.email, role, user.student)

  await prisma.instructor.upsert({
    where: { userId },
    create: { userId, displayName },
    update: {},
  })
}

export async function ensureInstructorProfiles() {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [...INSTRUCTOR_ELIGIBLE_ROLES] },
      isActive: true,
      instructor: { is: null },
    },
    include: { student: true },
  })

  for (const user of users) {
    await provisionRoleProfile(user.id, user.role as Role)
  }
}

export async function invalidateUserSessions(userId: string) {
  await prisma.deviceSession.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  })
}
