import { prisma } from "./prisma"
import { queueCertificateGeneration } from "../jobs/certificate.job"

export async function countCompletedLessonsForEnrollment(
  enrollmentId: string,
  lessonIds: string[]
): Promise<number> {
  if (lessonIds.length === 0) return 0

  const progressRows = await prisma.lessonProgress.findMany({
    where: { enrollmentId, lessonId: { in: lessonIds }, isCompleted: true },
  })

  return progressRows.length
}

export async function syncEnrollmentProgressAndCertificate(
  enrollmentId: string,
  studentId: string,
  courseId: string,
  userId: string
): Promise<number> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      course: { include: { sections: { include: { lessons: { select: { id: true } } } } } },
    },
  })
  if (!enrollment) return 0

  const lessonIds = enrollment.course.sections.flatMap((s) =>
    s.lessons.map((l) => l.id)
  )
  const totalLessons = lessonIds.length
  const completedCount = await countCompletedLessonsForEnrollment(
    enrollmentId,
    lessonIds
  )
  const progressPercent =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0
  const wasComplete = enrollment.progress === 100

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      progress: progressPercent,
      completedAt:
        progressPercent === 100
          ? enrollment.completedAt ?? new Date()
          : null,
      ...(progressPercent < 100 && {
        certificateStatus: null,
        certificateError: null,
      }),
    },
  })

  if (progressPercent === 100 && !wasComplete) {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { certificateStatus: "PENDING", certificateError: null },
    })
    await queueCertificateGeneration(studentId, courseId, userId)
  }

  return progressPercent
}
