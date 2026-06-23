import type { PrismaClient } from "@prisma/client"
import {
  daysAgo,
  getCourseLessonCount,
  seedEnrollmentWithLessons,
  upsertStudentUser,
} from "./helpers"
import { getCourseRatingStats } from "../../src/services/review.service"

export const INSTITUTIONAL_COURSE_SLUG = "institutional-forex-mastery"

export const INSTITUTIONAL_REVIEWERS = [
  {
    email: "meraj@review-seed.fxprime.test",
    firstName: "Meraj",
    lastName: "Hossain",
    rating: 5,
    review:
      "SMC and order block concepts explained clearly — the live setups are very practical.",
    daysAgo: 45,
  },
  {
    email: "karim@review-seed.fxprime.test",
    firstName: "Karim",
    lastName: "Ahmed",
    rating: 5,
    review:
      "The ICT liquidity sweep chapter is the best — it completely changed my institutional mindset.",
    daysAgo: 30,
  },
  {
    email: "nusrat@review-seed.fxprime.test",
    firstName: "Nusrat",
    lastName: "Jahan",
    rating: 4,
    review:
      "The FVG and market structure modules are helpful; adding more quizzes would make it even better.",
    daysAgo: 21,
  },
  {
    email: "rafi@review-seed.fxprime.test",
    firstName: "Rafi",
    lastName: "Islam",
    rating: 5,
    review:
      "Advanced topics explained in a way beginners can follow from start to finish.",
    daysAgo: 14,
  },
  {
    email: "tanvir@review-seed.fxprime.test",
    firstName: "Tanvir",
    lastName: "Hasan",
    rating: 5,
    review:
      "Applied the risk management section on a real account and started seeing consistent results.",
    daysAgo: 7,
  },
] as const

export async function seedInstitutionalCourseReviews(
  prisma: PrismaClient,
  passwordHash: string
) {
  const course = await prisma.course.findUnique({
    where: { slug: INSTITUTIONAL_COURSE_SLUG },
  })
  if (!course) return null

  const lessonCount = await getCourseLessonCount(prisma, INSTITUTIONAL_COURSE_SLUG)
  if (lessonCount === 0) return null

  let upserted = 0

  for (const reviewer of INSTITUTIONAL_REVIEWERS) {
    const user = await upsertStudentUser(prisma, {
      email: reviewer.email,
      passwordHash,
      role: "STUDENT",
      firstName: reviewer.firstName,
      lastName: reviewer.lastName,
      country: "Bangladesh",
    })

    const studentId = user.student!.id
    const completedAt = daysAgo(reviewer.daysAgo)

    await seedEnrollmentWithLessons(prisma, studentId, INSTITUTIONAL_COURSE_SLUG, {
      completedLessons: lessonCount,
      completedAt,
      certificateStatus: "ISSUED",
    })

    const existing = await prisma.courseReview.findUnique({
      where: {
        studentId_courseId: { studentId, courseId: course.id },
      },
    })

    if (existing) {
      await prisma.courseReview.update({
        where: { id: existing.id },
        data: { rating: reviewer.rating, review: reviewer.review },
      })
    } else {
      await prisma.courseReview.create({
        data: {
          studentId,
          courseId: course.id,
          rating: reviewer.rating,
          review: reviewer.review,
          createdAt: completedAt,
        },
      })
    }

    upserted++
  }

  const stats = await getCourseRatingStats(course.id)
  return { course, upserted, stats }
}
