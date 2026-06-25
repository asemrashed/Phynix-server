import type {
  CourseDetail,
  CourseFilters,
  CourseListItem,
  EnrollmentProgress,
  LessonProgressUpdate,
  LessonProgressResult,
  LessonType,
  StudentEnrollmentItem,
  StudentLessonDetail,
  VideoProvider,
} from "@fxprime/types"
import { parseCourseFaqs } from "../lib/course-marketing"
import { computeContinueLessonState } from "../lib/continue-learning"
import { getCached, invalidateCached, setCached } from "../lib/cache"
import { resolveLessonCompletion, shouldLogLearningActivity } from "../lib/progress-rules"
import {
  buildQuizReview,
  countQuizAttempts,
  enrichStudentQuizContent,
  getLatestQuizActivity,
  gradeQuiz,
  parseQuizContent,
} from "./quiz.service"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { ensureUniqueStudentId } from "./student-id.service"
import {
  getBatchCourseRatingStats,
  getCourseRatingStats,
  getStudentCourseReview,
  canReviewCourse,
} from "./review.service"
import { createNotification } from "./notification.service"
import { sendEnrollmentEmail } from "./email.service"
import { assertInstallmentCourseAccess } from "./installment-access.service"
import { syncEnrollmentProgressAndCertificate } from "../lib/course-completion"
import { getPublicInstructorStats } from "./instructor.service"

type CourseListRow = Prisma.CourseGetPayload<{
  include: { instructor: true; _count: { select: { enrollments: true } } }
}>

type CourseDetailRow = Prisma.CourseGetPayload<{
  include: {
    instructor: true
    sections: { include: { lessons: true } }
    installmentPlans: true
    _count: { select: { enrollments: true } }
  }
}>

type EnrollmentWithProgress = Prisma.EnrollmentGetPayload<{
  include: {
    lessonProgress: { include: { lesson: true } }
    course: { include: { sections: { include: { lessons: true } } } }
  }
}>

type EnrollmentWithCourse = Prisma.EnrollmentGetPayload<{
  include: { course: { include: { sections: { include: { lessons: true } } } } }
}>

export async function listCourses(
  filters: CourseFilters,
  studentId?: string
): Promise<{ courses: CourseListItem[]; total: number }> {
  const page = filters.page || 1
  const limit = filters.limit || 12
  const skip = (page - 1) * limit

  const cacheKey = studentId
    ? null
    : `courses:list:${page}:${limit}:${JSON.stringify(filters)}`

  if (cacheKey) {
    const cached = await getCached<{ courses: CourseListItem[]; total: number }>(cacheKey)
    if (cached) return cached
  }

  const where: Record<string, unknown> = { status: "PUBLISHED" }

  if (filters.level) where.level = filters.level
  if (filters.language) where.language = filters.language
  if (filters.featured) where.isFeatured = true
  if (filters.free) where.price = 0
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.price = {}
    if (filters.minPrice !== undefined) (where.price as Record<string, number>).gte = filters.minPrice
    if (filters.maxPrice !== undefined) (where.price as Record<string, number>).lte = filters.maxPrice
  }

  let orderBy: Record<string, string> = { createdAt: "desc" }
  if (filters.sort === "popular") orderBy = { enrollments: "desc" }
  if (filters.sort === "price_asc") orderBy = { price: "asc" }
  if (filters.sort === "price_desc") orderBy = { price: "desc" }

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        instructor: true,
        _count: { select: { enrollments: true } },
      },
    }),
    prisma.course.count({ where }),
  ])

  let enrollments: Record<string, { progress: number }> = {}
  if (studentId) {
    const enrolled = await prisma.enrollment.findMany({
      where: { studentId },
      select: { courseId: true, progress: true },
    })
    enrollments = Object.fromEntries(
      enrolled.map((e: { courseId: string; progress: number }) => [e.courseId, { progress: e.progress }])
    )
  }

  const ratingStats = await getBatchCourseRatingStats(
    courses.map((c: CourseListRow) => c.id)
  )

  const result = {
    courses: courses.map((c: CourseListRow) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      thumbnailUrl: c.thumbnailUrl,
      price: Number(c.price),
      originalPrice: c.originalPrice ? Number(c.originalPrice) : null,
      currency: c.currency,
      level: c.level,
      language: c.language,
      isFeatured: c.isFeatured,
      totalDuration: c.totalDuration,
      instructorName: c.instructor.displayName,
      enrollmentCount: c._count.enrollments,
      averageRating: ratingStats[c.id]?.averageRating ?? 0,
      reviewCount: ratingStats[c.id]?.reviewCount ?? 0,
      isEnrolled: !!enrollments[c.id],
      progress: enrollments[c.id]?.progress,
    })),
    total,
  }

  if (cacheKey) {
    await setCached(cacheKey, result, 120)
  }

  return result
}

export async function getCourseBySlug(
  slug: string,
  studentId?: string,
  options?: { previewUnpublished?: boolean }
): Promise<CourseDetail | null> {
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      instructor: true,
      sections: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" } },
        },
      },
      installmentPlans: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { enrollments: true } },
    },
  })

  if (!course) return null

  if (course.status !== "PUBLISHED" && !options?.previewUnpublished) {
    return null
  }

  let enrollment = null
  let lessonProgressMap: Record<string, { isCompleted: boolean; watchPosition: number }> = {}

  if (studentId) {
    enrollment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId: course.id } },
      include: { lessonProgress: true },
    })
    if (enrollment) {
      lessonProgressMap = Object.fromEntries(
        enrollment.lessonProgress.map((lp: { lessonId: string; isCompleted: boolean; watchPosition: number }) => [
          lp.lessonId,
          { isCompleted: lp.isCompleted, watchPosition: lp.watchPosition },
        ])
      )
    }
  }

  const { averageRating, reviewCount } = await getCourseRatingStats(course.id)
  const instructorStats = await getPublicInstructorStats(course.instructorId)
  const activePlan = course.installmentPlans[0] ?? null
  const enrollmentCount = course._count.enrollments
  const seatsRemaining =
    course.seatLimit != null ? Math.max(0, course.seatLimit - enrollmentCount) : null

  const myReview =
    studentId && enrollment
      ? await getStudentCourseReview(studentId, course.id)
      : null
  const hasReviewed = !!myReview
  const canReview =
    !!enrollment &&
    (hasReviewed ||
      canReviewCourse(enrollment.progress, enrollment.certificateStatus))

  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    subtitle: course.subtitle,
    badgeLabel: course.badgeLabel,
    highlights: course.highlights,
    faqs: parseCourseFaqs(course.faqs),
    discountEndsAt: course.discountEndsAt?.toISOString() ?? null,
    seatLimit: course.seatLimit,
    seatsRemaining,
    startsAt: course.startsAt?.toISOString() ?? null,
    classSchedule: course.classSchedule,
    deliveryType: course.deliveryType,
    refundDays: course.refundDays,
    learningOutcomes: course.learningOutcomes,
    thumbnailUrl: course.thumbnailUrl,
    price: Number(course.price),
    originalPrice: course.originalPrice ? Number(course.originalPrice) : null,
    currency: course.currency,
    level: course.level,
    language: course.language,
    isFeatured: course.isFeatured,
    totalDuration: course.totalDuration,
    instructorName: course.instructor.displayName,
    instructorTitle: course.instructor.title,
    instructorBio: course.instructor.bio,
    instructorPhotoUrl: course.instructor.photoUrl,
    instructorStats,
    installmentPlan: activePlan
      ? {
          label: activePlan.label,
          installmentCount: activePlan.installmentCount,
        }
      : null,
    enrollmentCount,
    averageRating,
    reviewCount,
    status: course.status,
    isEnrolled: !!enrollment,
    progress: enrollment?.progress ?? 0,
    myReview,
    canReview,
    hasReviewed,
    certificateStatus: enrollment?.certificateStatus ?? null,
    sections: course.sections.map((s: CourseDetailRow["sections"][number]) => ({
      id: s.id,
      title: s.title,
      order: s.order,
      lessons: s.lessons.map((l: CourseDetailRow["sections"][number]["lessons"][number]) => ({
        id: l.id,
        title: l.title,
        type: l.type as LessonType,
        duration: l.duration,
        order: l.order,
        isFree: l.isFree,
        isCompleted: lessonProgressMap[l.id]?.isCompleted,
        watchPosition: lessonProgressMap[l.id]?.watchPosition,
      })),
    })),
  }
}

export async function enrollInCourse(studentId: string, courseId: string, userId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } })
  if (!course) throw Object.assign(new Error("Course not found"), { code: "NOT_FOUND" })
  if (course.status !== "PUBLISHED") {
    throw Object.assign(new Error("Course not available"), { code: "NOT_AVAILABLE" })
  }

  const existing = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  })
  if (existing) {
    throw Object.assign(new Error("Already enrolled"), { code: "ALREADY_ENROLLED" })
  }

  const price = Number(course.price)
  if (price > 0) {
    const payment = await prisma.paymentRecord.findFirst({
      where: { studentId, courseId, status: "COMPLETED" },
    })
    if (!payment) {
      throw Object.assign(new Error("Payment required"), { code: "PAYMENT_REQUIRED" })
    }
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student) throw Object.assign(new Error("Student not found"), { code: "NOT_FOUND" })

  const enrollment = await prisma.enrollment.create({
    data: { studentId, courseId },
  })

  const uniqueStudentId = await ensureUniqueStudentId(studentId)

  await createNotification(
    userId,
    "COURSE_ENROLLED",
    "Enrollment Confirmed",
    `You are now enrolled in ${course.title}`,
    `/dashboard/courses/${course.slug}`
  )

  const studentWithUser = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  })
  if (studentWithUser?.user?.email) {
    await sendEnrollmentEmail(
      studentWithUser.user.email,
      studentWithUser.firstName,
      course.title
    )
  }

  return { enrollment, uniqueStudentId }
}

export async function getEnrollmentProgress(
  studentId: string,
  courseId: string
): Promise<EnrollmentProgress | null> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    include: {
      lessonProgress: {
        include: { lesson: true },
        orderBy: { lesson: { order: "desc" } },
      },
      course: {
        include: { sections: { include: { lessons: true } } },
      },
    },
  })

  if (!enrollment) return null

  const totalLessons = enrollment.course.sections.reduce(
    (sum: number, s: EnrollmentWithProgress["course"]["sections"][number]) => sum + s.lessons.length,
    0
  )
  const completedLessons = enrollment.lessonProgress.filter(
    (lp: EnrollmentWithProgress["lessonProgress"][number]) => lp.isCompleted
  ).length

  const continueState = computeContinueLessonState(
    enrollment.course.sections,
    enrollment.lessonProgress
  )

  return {
    enrollmentId: enrollment.id,
    courseId,
    progress: enrollment.progress,
    completedLessons,
    totalLessons,
    lastLessonId: continueState.lastLessonId,
    lastLessonTitle: continueState.lastLessonTitle,
    watchPosition: continueState.watchPosition,
  }
}

export async function getStudentLesson(
  studentId: string,
  courseId: string,
  lessonId: string
): Promise<StudentLessonDetail> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  })

  if (!enrollment) {
    throw Object.assign(new Error("Not enrolled"), { code: "NOT_ENROLLED" })
  }

  await assertInstallmentCourseAccess(studentId, courseId)

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, section: { courseId } },
  })

  if (!lesson) {
    throw Object.assign(new Error("Lesson not found"), { code: "NOT_FOUND" })
  }

  const progress = await prisma.lessonProgress.findUnique({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
  })

  const quizActivity =
    lesson.type === "QUIZ"
      ? await getLatestQuizActivity(studentId, lessonId)
      : null

  const meta = (quizActivity?.metadata ?? {}) as Record<string, unknown>

  let content: StudentLessonDetail["content"]
  let quizAttemptsUsed = 0
  let quizAttemptsRemaining = 3

  if (lesson.type === "TEXT") {
    content = { html: lesson.content || "<p>No content</p>" }
  } else if (lesson.type === "QUIZ") {
    const quiz = parseQuizContent(lesson.content)
    quizAttemptsUsed = await countQuizAttempts(studentId, lessonId)
    quizAttemptsRemaining = Math.max(0, (quiz.maxAttempts ?? 3) - quizAttemptsUsed)

    const isPassed = progress?.isCompleted ?? false
    content = enrichStudentQuizContent(
      quiz,
      isPassed && meta.review ? meta : null
    )
  } else {
    content = {
      provider: (lesson.videoProvider as VideoProvider) || "YOUTUBE",
      videoRef: lesson.videoRef,
    }
  }

  return {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type as LessonType,
    duration: lesson.duration,
    content,
    isCompleted: progress?.isCompleted ?? false,
    quizScore: typeof meta.score === "number" ? meta.score : null,
    quizAttemptsUsed,
    quizAttemptsRemaining,
  }
}

export async function updateLessonProgress(
  studentId: string,
  courseId: string,
  lessonId: string,
  userId: string,
  data: LessonProgressUpdate
): Promise<LessonProgressResult> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    include: {
      course: { include: { sections: { include: { lessons: true } } } },
    },
  })

  if (!enrollment) {
    throw Object.assign(new Error("Not enrolled"), { code: "NOT_ENROLLED" })
  }

  await assertInstallmentCourseAccess(studentId, courseId)

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } })
  if (!lesson) throw Object.assign(new Error("Lesson not found"), { code: "NOT_FOUND" })

  const existingProgress = await prisma.lessonProgress.findUnique({
    where: {
      enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
    },
  })

  let isCompleted = resolveLessonCompletion(lesson.type, {
    isCompleted: data.isCompleted,
    watchPosition: data.watchPosition,
    duration: lesson.duration,
    existingCompleted: existingProgress?.isCompleted,
  })
  let quizScore: number | undefined
  let quizPassed: boolean | undefined
  let quizAttemptsUsed: number | undefined
  let quizAttemptsRemaining: number | undefined
  let quizPerQuestion: import("@fxprime/types").QuizQuestionResultItem[] | undefined
  let quizReview: import("@fxprime/types").QuizLessonContent["review"] | undefined

  if (lesson.type === "QUIZ" && data.quizAnswers) {
    if (existingProgress?.isCompleted) {
      throw Object.assign(new Error("Quiz already passed"), { code: "QUIZ_ALREADY_PASSED" })
    }

    const quiz = parseQuizContent(lesson.content)
    const attemptsUsed = await countQuizAttempts(studentId, lessonId)
    const maxAttempts = quiz.maxAttempts ?? 3

    if (attemptsUsed >= maxAttempts) {
      throw Object.assign(
        new Error(`Maximum attempts (${maxAttempts}) reached`),
        { code: "QUIZ_MAX_ATTEMPTS" }
      )
    }

    const result = gradeQuiz(quiz, data.quizAnswers)
    quizScore = result.score
    quizPassed = result.passed
    quizPerQuestion = result.perQuestion
    quizAttemptsUsed = attemptsUsed + 1
    quizAttemptsRemaining = Math.max(0, maxAttempts - quizAttemptsUsed)
    isCompleted = result.passed

    if (result.passed) {
      const review = buildQuizReview(quiz, data.quizAnswers, result.score)
      quizReview = review

      await prisma.learningActivity.create({
        data: {
          studentId,
          type: "QUIZ_COMPLETED",
          entityId: lessonId,
          entityType: "LESSON",
          metadata: {
            courseId,
            score: result.score,
            correctCount: result.correctCount,
            total: result.total,
            review: review as unknown as Prisma.InputJsonValue,
          } as Prisma.InputJsonObject,
        },
      })
    } else {
      await prisma.learningActivity.create({
        data: {
          studentId,
          type: "QUIZ_ATTEMPT",
          entityId: lessonId,
          entityType: "LESSON",
          metadata: {
            courseId,
            score: result.score,
            correctCount: result.correctCount,
            total: result.total,
            answers: data.quizAnswers,
          },
        },
      })
    }
  }

  const progress = await prisma.lessonProgress.upsert({
    where: {
      enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
    },
    create: {
      enrollmentId: enrollment.id,
      lessonId,
      watchPosition: data.watchPosition ?? 0,
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
    },
    update: {
      ...(data.watchPosition !== undefined && { watchPosition: data.watchPosition }),
      ...(data.isCompleted !== undefined && {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      }),
    },
  })

  const progressPercent = await syncEnrollmentProgressAndCertificate(
    enrollment.id,
    studentId,
    courseId,
    userId
  )

  if (lesson.type !== "QUIZ") {
    await prisma.learningActivity.create({
      data: {
        studentId,
        type: isCompleted ? "LESSON_COMPLETED" : "LESSON_PAUSED",
        entityId: lessonId,
        entityType: "LESSON",
        metadata: { courseId, watchPosition: data.watchPosition },
      },
    })
  }

  await Promise.all([
    invalidateCached(`portfolio:${studentId}`),
    invalidateCached(`learning_goals:${studentId}`),
  ])

  return {
    progress: progressPercent,
    isCompleted: progress.isCompleted,
    quizScore,
    quizPassed,
    quizAttemptsUsed,
    quizAttemptsRemaining,
    quizPerQuestion,
    quizReview,
  }
}

export async function getStudentEnrollments(
  studentId: string
): Promise<StudentEnrollmentItem[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: {
      course: {
        include: {
          sections: { include: { lessons: { select: { id: true, title: true, order: true } } } },
        },
      },
      lessonProgress: {
        select: { lessonId: true, isCompleted: true, watchPosition: true },
      },
    },
    orderBy: { enrolledAt: "desc" },
  })

  return enrollments.map((enrollment) => {
    const continueState = computeContinueLessonState(
      enrollment.course.sections,
      enrollment.lessonProgress
    )

    const totalLessons = enrollment.course.sections.reduce(
      (sum, section) => sum + section.lessons.length,
      0
    )
    const completedLessons = enrollment.lessonProgress.filter(
      (lp) => lp.isCompleted
    ).length

    return {
      id: enrollment.id,
      progress: enrollment.progress,
      enrolledAt: enrollment.enrolledAt.toISOString(),
      lastLessonId: continueState.lastLessonId,
      lastLessonTitle: continueState.lastLessonTitle,
      watchPosition: continueState.watchPosition,
      totalLessons,
      completedLessons,
      course: {
        id: enrollment.course.id,
        title: enrollment.course.title,
        slug: enrollment.course.slug,
        thumbnailUrl: enrollment.course.thumbnailUrl,
        level: enrollment.course.level,
        language: enrollment.course.language,
      },
    }
  })
}
