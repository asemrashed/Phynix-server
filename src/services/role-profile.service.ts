import type { Role } from "@fxprime/types"
import { prisma } from "../lib/prisma"

function resolveDisplayName(
  email: string,
  student?: { firstName: string; lastName: string } | null
) {
  if (student) return `${student.firstName} ${student.lastName}`.trim()
  return email.split("@")[0]
}

export async function provisionRoleProfile(userId: string, role: Role) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { student: true },
  })
  if (!user) return

  const displayName = resolveDisplayName(user.email, user.student)

  if (role === "INSTRUCTOR") {
    await prisma.instructor.upsert({
      where: { userId },
      create: { userId, displayName },
      update: {},
    })
  }
}

export async function ensureInstructorProfiles() {
  const users = await prisma.user.findMany({
    where: { role: "INSTRUCTOR", isActive: true, instructor: { is: null } },
    include: { student: true },
  })

  for (const user of users) {
    await provisionRoleProfile(user.id, "INSTRUCTOR")
  }
}

export async function invalidateUserSessions(userId: string) {
  await prisma.deviceSession.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  })
}
