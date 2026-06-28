import { prisma } from "../lib/prisma"

export const REVIEW_PROGRESS_THRESHOLD = 80

function roundRating(value: number | null | undefined): number {
  if (!value) return 0
  return Math.round(value * 10) / 10
}

export function canReviewCourse(
  progress: number,
  certificateStatus: string | null | undefined
): boolean {
  return (
    progress >= REVIEW_PROGRESS_THRESHOLD || certificateStatus === "ISSUED"
  )
}

export async function getCourseRatingStats(courseId: string) {
  const agg = await prisma.courseReview.aggregate({
    where: { courseId },
    _avg: { rating: true },
    _count: { rating: true },
  })

  return {
    averageRating: roundRating(agg._avg.rating),
    reviewCount: agg._count.rating,
  }
}

export async function getBatchCourseRatingStats(courseIds: string[]) {
  if (courseIds.length === 0) return {}

  const groups = await prisma.courseReview.groupBy({
    by: ["courseId"],
    where: { courseId: { in: courseIds } },
    _avg: { rating: true },
    _count: { rating: true },
  })

  return Object.fromEntries(
    groups.map((g) => [
      g.courseId,
      {
        averageRating: roundRating(g._avg.rating),
        reviewCount: g._count.rating,
      },
    ])
  )
}

export async function getStudentCourseReview(
  studentId: string,
  courseId: string
) {
  const review = await prisma.courseReview.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    include: {
      student: { select: { firstName: true, lastName: true } },
    },
  })

  if (!review) return null

  return {
    id: review.id,
    rating: review.rating,
    review: review.review,
    studentName: `${review.student.firstName} ${review.student.lastName}`,
    createdAt: review.createdAt.toISOString(),
    isOwn: true,
  }
}

export async function listRecentCourseReviews(limit = 6) {
  const reviews = await prisma.courseReview.findMany({
    where: { review: { not: null } },
    include: {
      student: { select: { firstName: true, lastName: true, avatarUrl: true } },
      course: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    review: r.review,
    studentName: `${r.student.firstName} ${r.student.lastName.charAt(0)}.`,
    studentAvatar: r.student.avatarUrl,
    courseName: r.course.title,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function listCourseReviews(courseId: string, limit = 20) {
  const reviews = await prisma.courseReview.findMany({
    where: { courseId },
    include: {
      student: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    review: r.review,
    studentName: `${r.student.firstName} ${r.student.lastName.charAt(0)}.`,
    createdAt: r.createdAt.toISOString(),
    isOwn: false,
  }))
}

export async function submitCourseReview(
  studentId: string,
  courseId: string,
  rating: number,
  review?: string
) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  })

  if (!enrollment) {
    throw Object.assign(new Error("Enroll in the course to leave a review"), {
      code: "NOT_ENROLLED",
    })
  }

  const existingReview = await prisma.courseReview.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  })

  if (
    !existingReview &&
    !canReviewCourse(enrollment.progress, enrollment.certificateStatus)
  ) {
    throw Object.assign(
      new Error(
        `Complete at least ${REVIEW_PROGRESS_THRESHOLD}% of the course before leaving a review`
      ),
      { code: "CANNOT_REVIEW_YET" }
    )
  }

  if (rating < 1 || rating > 5) {
    throw Object.assign(new Error("Rating must be between 1 and 5"), {
      code: "INVALID_RATING",
    })
  }

  const saved = await prisma.courseReview.upsert({
    where: { studentId_courseId: { studentId, courseId } },
    create: {
      studentId,
      courseId,
      rating,
      review: review?.trim() || null,
    },
    update: {
      rating,
      review: review?.trim() || null,
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
    },
  })

  const stats = await getCourseRatingStats(courseId)

  return {
    id: saved.id,
    rating: saved.rating,
    review: saved.review,
    studentName: `${saved.student.firstName} ${saved.student.lastName}`,
    createdAt: saved.createdAt.toISOString(),
    isOwn: true,
    ...stats,
  }
}

export async function recalculateMentorRating(mentorId: string) {
  const agg = await prisma.mentorBooking.aggregate({
    where: { mentorId, rating: { not: null } },
    _avg: { rating: true },
  })

  await prisma.mentor.update({
    where: { id: mentorId },
    data: { averageRating: roundRating(agg._avg.rating) },
  })

  return roundRating(agg._avg.rating)
}

export async function submitMentorBookingReview(
  studentId: string,
  bookingId: string,
  rating: number,
  review?: string
) {
  const booking = await prisma.mentorBooking.findUnique({
    where: { id: bookingId },
  })

  if (!booking || booking.studentId !== studentId) {
    throw Object.assign(new Error("Booking not found"), { code: "NOT_FOUND" })
  }

  if (!["COMPLETED", "CONFIRMED"].includes(booking.status)) {
    throw Object.assign(new Error("Session must be completed to review"), {
      code: "INVALID_STATE",
    })
  }

  if (booking.rating !== null) {
    throw Object.assign(new Error("Review already submitted"), {
      code: "ALREADY_REVIEWED",
    })
  }

  if (rating < 1 || rating > 5) {
    throw Object.assign(new Error("Rating must be between 1 and 5"), {
      code: "INVALID_RATING",
    })
  }

  const updated = await prisma.mentorBooking.update({
    where: { id: bookingId },
    data: {
      rating,
      review: review?.trim() || null,
      status: booking.status === "CONFIRMED" ? "COMPLETED" : booking.status,
    },
    include: { mentor: true, slot: true },
  })

  const averageRating = await recalculateMentorRating(booking.mentorId)

  return {
    id: updated.id,
    mentorName: updated.mentor.displayName,
    scheduledAt: updated.slot.date.toISOString(),
    status: updated.status,
    zoomUrl: updated.zoomUrl,
    rating: updated.rating,
    review: updated.review,
    mentorAverageRating: averageRating,
    createdAt: updated.createdAt.toISOString(),
  }
}
