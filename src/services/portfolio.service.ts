import type { CertificateItem, StudentPortfolio } from "@fxprime/types"
import { getCached, setCached } from "../lib/cache"
import { prisma } from "../lib/prisma"

export async function getStudentPortfolio(studentId: string): Promise<StudentPortfolio> {
  const cacheKey = `portfolio:${studentId}`
  const cached = await getCached<StudentPortfolio>(cacheKey)
  if (cached) return cached
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { createdAt: true } } },
  })

  if (!student) {
    throw Object.assign(new Error("Student not found"), { code: "NOT_FOUND" })
  }

  const [enrollments, certificates, watchAgg, completedCourses] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            level: true,
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    }),
    prisma.certificate.findMany({
      where: { studentId, isRevoked: false },
      include: { course: true },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.lessonProgress.aggregate({
      where: { enrollment: { studentId } },
      _sum: { watchPosition: true },
    }),
    prisma.enrollment.count({
      where: { studentId, progress: 100 },
    }),
  ])

  const certItems: CertificateItem[] = certificates.map((c) => ({
    id: c.id,
    certCode: c.certCode,
    courseTitle: c.course.title,
    pdfUrl: c.pdfUrl || "",
    issuedAt: c.issuedAt.toISOString(),
    isRevoked: c.isRevoked,
  }))

  const learningSeconds = watchAgg._sum.watchPosition ?? 0

  const portfolio: StudentPortfolio = {
    profile: {
      id: student.id,
      uniqueStudentId: student.uniqueStudentId,
      firstName: student.firstName,
      lastName: student.lastName,
      phone: student.phone,
      country: student.country,
      avatarUrl: student.avatarUrl,
      registrationType: student.registrationType,
      memberSince: student.user.createdAt.toISOString(),
    },
    stats: {
      coursesEnrolled: enrollments.length,
      coursesCompleted: completedCourses,
      certificates: certItems.length,
      learningHours: Math.round(learningSeconds / 3600),
    },
    enrollments: enrollments.map((e) => ({
      id: e.id,
      progress: e.progress,
      enrolledAt: e.enrolledAt.toISOString(),
      completedAt: e.completedAt?.toISOString() ?? null,
      course: e.course,
    })),
    certificates: certItems,
  }

  await setCached(cacheKey, portfolio, 60)
  return portfolio
}
