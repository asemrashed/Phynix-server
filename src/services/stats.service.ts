import type { PlatformStats, AdminStats } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { countReportedCommunityPosts } from "./community.service"

export async function getPlatformStats(): Promise<PlatformStats> {
  const [students, courses, enrollments, certificates] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.course.count({ where: { status: "PUBLISHED" } }),
    prisma.enrollment.count(),
    prisma.certificate.count({ where: { isRevoked: false } }),
  ])

  const mentors = await prisma.instructor.count()

  return { students, courses, enrollments, certificates, mentors }
}

export async function getAdminStats(): Promise<AdminStats> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalStudents,
    totalCourses,
    publishedCourses,
    totalEnrollments,
    totalCertificates,
    paymentsToday,
    paymentsMonth,
    upcomingLiveSessions,
    communityReportedPosts,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.course.count(),
    prisma.course.count({ where: { status: "PUBLISHED" } }),
    prisma.enrollment.count(),
    prisma.certificate.count({ where: { isRevoked: false } }),
    prisma.paymentRecord.findMany({
      where: { status: "COMPLETED", updatedAt: { gte: startOfDay } },
      select: { amount: true },
    }),
    prisma.paymentRecord.findMany({
      where: { status: "COMPLETED", updatedAt: { gte: startOfMonth } },
      select: { amount: true },
    }),
    prisma.liveSession.count({
      where: {
        status: "SCHEDULED",
        scheduledAt: { gte: now },
      },
    }),
    countReportedCommunityPosts(),
  ])

  const sum = (records: { amount: unknown }[]) =>
    records.reduce((acc, r) => acc + Number(r.amount), 0)

  return {
    totalStudents,
    totalCourses,
    publishedCourses,
    totalEnrollments,
    totalCertificates,
    revenueToday: sum(paymentsToday),
    revenueMonth: sum(paymentsMonth),
    upcomingLiveSessions,
    communityReportedPosts,
  }
}
