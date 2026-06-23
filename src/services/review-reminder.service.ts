import { prisma } from "../lib/prisma"
import { createNotification } from "./notification.service"
import { sendCourseReviewReminderEmail } from "./email.service"
import { canReviewCourse } from "./review.service"

const REMINDER_AFTER_DAYS = 3

export async function processCourseReviewReminders(): Promise<{ sent: number }> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - REMINDER_AFTER_DAYS)

  const enrollments = await prisma.enrollment.findMany({
    where: {
      reviewReminderSentAt: null,
      completedAt: { not: null, lte: cutoff },
      progress: 100,
    },
    include: {
      student: { include: { user: true } },
      course: { select: { id: true, title: true, slug: true } },
    },
    take: 100,
  })

  if (enrollments.length === 0) return { sent: 0 }

  const existingReviews = await prisma.courseReview.findMany({
    where: {
      OR: enrollments.map((e) => ({
        studentId: e.studentId,
        courseId: e.courseId,
      })),
    },
    select: { studentId: true, courseId: true },
  })

  const reviewedKeys = new Set(
    existingReviews.map((r) => `${r.studentId}:${r.courseId}`)
  )

  let sent = 0

  for (const enrollment of enrollments) {
    const key = `${enrollment.studentId}:${enrollment.courseId}`
    if (reviewedKeys.has(key)) continue

    if (!canReviewCourse(enrollment.progress, enrollment.certificateStatus)) {
      continue
    }

    const userId = enrollment.student.userId
    const reviewLink = `/dashboard/courses/${enrollment.course.slug}?review=1`

    await createNotification(
      userId,
      "COURSE_REVIEW_REMINDER",
      "How was your course?",
      `Share your experience with "${enrollment.course.title}" — it helps other traders choose the right path.`,
      reviewLink
    )

    if (enrollment.student.user?.email) {
      await sendCourseReviewReminderEmail(
        enrollment.student.user.email,
        enrollment.student.firstName,
        enrollment.course.title,
        enrollment.course.slug
      )
    }

    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { reviewReminderSentAt: new Date() },
    })

    sent++
  }

  return { sent }
}
