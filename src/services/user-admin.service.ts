import type { AdminUserDetail, Role } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { ensureUniqueStudentId } from "./student-id.service"
import { createNotification } from "./notification.service"
import { sendEnrollmentEmail } from "./email.service"
import { provisionRoleProfile, invalidateUserSessions } from "./role-profile.service"

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      student: {
        include: {
          enrollments: {
            include: { course: { select: { id: true, title: true, slug: true } } },
            orderBy: { enrolledAt: "desc" },
          },
        },
      },
      deviceSessions: {
        where: { isActive: true },
        orderBy: { lastActiveAt: "desc" },
      },
    },
  })

  if (!user) {
    throw Object.assign(new Error("User not found"), { code: "NOT_FOUND" })
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    isActive: user.isActive,
    isVerified: user.isVerified,
    createdAt: user.createdAt.toISOString(),
    studentId: user.student?.id ?? null,
    studentName: user.student ? `${user.student.firstName} ${user.student.lastName}` : null,
    uniqueStudentId: user.student?.uniqueStudentId ?? null,
    enrollments:
      user.student?.enrollments.map((e) => ({
        id: e.id,
        courseId: e.courseId,
        courseTitle: e.course.title,
        courseSlug: e.course.slug,
        progress: e.progress,
        enrolledAt: e.enrolledAt.toISOString(),
      })) ?? [],
    deviceSessions: user.deviceSessions.map((s) => ({
      id: s.id,
      deviceType: s.deviceType,
      ipAddress: s.ipAddress,
      lastActiveAt: s.lastActiveAt.toISOString(),
    })),
  }
}

export async function updateAdminUser(
  userId: string,
  data: { isActive?: boolean; role?: Role }
) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw Object.assign(new Error("User not found"), { code: "NOT_FOUND" })
  }

  if (user.role === "SUPER_ADMIN" && data.role && data.role !== "SUPER_ADMIN") {
    throw Object.assign(new Error("Cannot change super admin role"), { code: "FORBIDDEN" })
  }

  const roleChanged = !!data.role && data.role !== user.role

  await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: data.isActive,
      role: data.role,
    },
  })

  if (roleChanged && data.role) {
    await provisionRoleProfile(userId, data.role)
    await invalidateUserSessions(userId)
  }

  return getAdminUserDetail(userId)
}

export async function grantManualEnrollment(userId: string, courseId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { student: true },
  })

  if (!user?.student) {
    throw Object.assign(new Error("Student profile not found"), { code: "NOT_FOUND" })
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } })
  if (!course) {
    throw Object.assign(new Error("Course not found"), { code: "NOT_FOUND" })
  }

  const existing = await prisma.enrollment.findUnique({
    where: {
      studentId_courseId: { studentId: user.student.id, courseId },
    },
  })

  if (existing) {
    throw Object.assign(new Error("Already enrolled"), { code: "ALREADY_ENROLLED" })
  }

  const enrollment = await prisma.enrollment.create({
    data: { studentId: user.student.id, courseId },
  })

  await ensureUniqueStudentId(user.student.id)

  await createNotification(
    userId,
    "COURSE_ENROLLED",
    "Enrollment Granted",
    `You have been enrolled in ${course.title}`,
    `/dashboard/courses/${course.slug}`
  )

  await sendEnrollmentEmail(user.email, user.student.firstName, course.title)

  return {
    enrollmentId: enrollment.id,
    courseTitle: course.title,
  }
}

export async function resetUserDeviceSessions(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw Object.assign(new Error("User not found"), { code: "NOT_FOUND" })
  }

  const result = await prisma.deviceSession.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  })

  return { resetCount: result.count }
}
