import path from "path"
import fs from "fs"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { provisionRoleProfile } from "./role-profile.service"
import { saveImageUpload } from "./upload.service"
import { getBatchCourseRatingStats, getCourseRatingStats, listCourseReviews } from "./review.service"

function roundRating(value: number | null | undefined): number {
  if (!value) return 0
  return Math.round(value * 10) / 10
}

async function requireInstructor(userId: string) {
  let instructor = await prisma.instructor.findUnique({
    where: { userId },
  })

  if (!instructor) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (user?.role !== "INSTRUCTOR") {
      throw Object.assign(new Error("Instructor profile not found"), { code: "NOT_FOUND" })
    }
    await provisionRoleProfile(userId, "INSTRUCTOR")
    instructor = await prisma.instructor.findUnique({ where: { userId } })
    if (!instructor) {
      throw Object.assign(new Error("Instructor profile not found"), { code: "NOT_FOUND" })
    }
  }

  return instructor
}

async function requireInstructorCourse(userId: string, slug: string) {
  const instructor = await requireInstructor(userId)
  const course = await prisma.course.findFirst({
    where: { slug, instructorId: instructor.id },
    include: { _count: { select: { enrollments: true } } },
  })
  if (!course) {
    throw Object.assign(new Error("Course not found"), { code: "NOT_FOUND" })
  }
  return { instructor, course }
}

async function getInstructorCourseIds(instructorId: string): Promise<string[]> {
  const courses = await prisma.course.findMany({
    where: { instructorId },
    select: { id: true },
  })
  return courses.map((c) => c.id)
}

function mapCourseItem(
  c: {
    id: string
    title: string
    slug: string
    status: string
    level: string
    createdAt: Date
    _count: { enrollments: number }
  }
) {
  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    status: c.status,
    level: c.level,
    enrollmentCount: c._count.enrollments,
    createdAt: c.createdAt.toISOString(),
  }
}

async function aggregateInstructorStats(instructorId: string, courseIds: string[]) {
  if (courseIds.length === 0) {
    return {
      courseCount: 0,
      enrollmentCount: 0,
      publishedCount: 0,
      avgCompletionRate: 0,
      activeLearners: 0,
      averageRating: 0,
    }
  }

  const [publishedCount, enrollmentAgg, activeLearners, ratingAgg] = await Promise.all([
    prisma.course.count({
      where: { instructorId, status: "PUBLISHED" },
    }),
    prisma.enrollment.aggregate({
      where: { courseId: { in: courseIds } },
      _avg: { progress: true },
      _count: { id: true },
    }),
    prisma.enrollment.count({
      where: {
        courseId: { in: courseIds },
        progress: { gt: 0 },
        completedAt: null,
      },
    }),
    prisma.courseReview.aggregate({
      where: { courseId: { in: courseIds } },
      _avg: { rating: true },
    }),
  ])

  return {
    courseCount: courseIds.length,
    enrollmentCount: enrollmentAgg._count.id,
    publishedCount,
    avgCompletionRate: Math.round(enrollmentAgg._avg.progress ?? 0),
    activeLearners,
    averageRating: roundRating(ratingAgg._avg.rating),
  }
}

export async function getPublicInstructorStats(instructorId: string) {
  const courseIds = await getInstructorCourseIds(instructorId)
  if (courseIds.length === 0) return null
  const stats = await aggregateInstructorStats(instructorId, courseIds)
  return {
    averageRating: stats.averageRating,
    totalStudents: stats.enrollmentCount,
    courseCount: stats.publishedCount,
  }
}

export async function getInstructorCourses(userId: string) {
  const instructor = await requireInstructor(userId)

  const courses = await prisma.course.findMany({
    where: { instructorId: instructor.id },
    include: { _count: { select: { enrollments: true } } },
    orderBy: { createdAt: "desc" },
  })

  return courses.map(mapCourseItem)
}

export async function getInstructorCourseDetail(userId: string, slug: string) {
  const { course } = await requireInstructorCourse(userId, slug)

  const [avgProgress, completedCount, ratingStats] = await Promise.all([
    prisma.enrollment.aggregate({
      where: { courseId: course.id },
      _avg: { progress: true },
    }),
    prisma.enrollment.count({
      where: { courseId: course.id, completedAt: { not: null } },
    }),
    getCourseRatingStats(course.id),
  ])

  return {
    ...mapCourseItem(course),
    averageRating: ratingStats.averageRating,
    reviewCount: ratingStats.reviewCount,
    avgProgress: Math.round(avgProgress._avg.progress ?? 0),
    completedCount,
  }
}

export async function getInstructorCourseStudents(
  userId: string,
  slug: string,
  opts: { page?: number; limit?: number; search?: string } = {}
) {
  const { course } = await requireInstructorCourse(userId, slug)

  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20))
  const skip = (page - 1) * limit
  const search = opts.search?.trim()

  const where: Prisma.EnrollmentWhereInput = { courseId: course.id }
  if (search) {
    where.student = {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { uniqueStudentId: { contains: search, mode: "insensitive" } },
      ],
    }
  }

  const [enrollments, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      include: {
        student: {
          select: { firstName: true, lastName: true, uniqueStudentId: true },
        },
      },
      orderBy: { enrolledAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.enrollment.count({ where }),
  ])

  return {
    students: enrollments.map((e) => ({
      enrollmentId: e.id,
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      studentId: e.student.uniqueStudentId,
      enrolledAt: e.enrolledAt.toISOString(),
      progress: e.progress,
      completedAt: e.completedAt?.toISOString() ?? null,
    })),
    total,
    page,
    limit,
  }
}

export async function getInstructorCourseReviews(userId: string, slug: string, limit = 20) {
  const { course } = await requireInstructorCourse(userId, slug)
  return listCourseReviews(course.id, limit)
}

export async function getInstructorProfile(userId: string) {
  const instructor = await requireInstructor(userId)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  return {
    id: instructor.id,
    email: user?.email ?? "",
    displayName: instructor.displayName,
    title: instructor.title,
    bio: instructor.bio,
    photoUrl: instructor.photoUrl,
  }
}

export async function updateInstructorProfile(
  userId: string,
  data: { displayName?: string; title?: string | null; bio?: string | null }
) {
  const instructor = await requireInstructor(userId)
  const updated = await prisma.instructor.update({
    where: { id: instructor.id },
    data: {
      displayName: data.displayName?.trim() || instructor.displayName,
      title: data.title !== undefined ? data.title?.trim() || null : instructor.title,
      bio: data.bio !== undefined ? data.bio?.trim() || null : instructor.bio,
    },
  })
  return {
    id: updated.id,
    displayName: updated.displayName,
    title: updated.title,
    bio: updated.bio,
    photoUrl: updated.photoUrl,
  }
}

export async function updateInstructorPhoto(
  userId: string,
  buffer: Buffer,
  mimetype: string,
  originalName: string
) {
  const instructor = await requireInstructor(userId)
  const photoUrl = await saveImageUpload(buffer, mimetype, originalName, "instructors")

  if (instructor.photoUrl) {
    const oldPath = path.join(process.cwd(), instructor.photoUrl.replace(/^\//, ""))
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath)
    }
  }

  const updated = await prisma.instructor.update({
    where: { id: instructor.id },
    data: { photoUrl },
  })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })

  return {
    id: updated.id,
    email: user?.email ?? "",
    displayName: updated.displayName,
    bio: updated.bio,
    photoUrl: updated.photoUrl,
  }
}

export async function getInstructorAnalytics(userId: string) {
  const instructor = await requireInstructor(userId)

  const courses = await prisma.course.findMany({
    where: { instructorId: instructor.id },
    include: { _count: { select: { enrollments: true } } },
    orderBy: { createdAt: "desc" },
  })

  const courseIds = courses.map((c) => c.id)

  const [stats, progressByCourse, ratingStats, recentEnrollments] = await Promise.all([
    aggregateInstructorStats(instructor.id, courseIds),
    courseIds.length
      ? prisma.enrollment.groupBy({
          by: ["courseId"],
          where: { courseId: { in: courseIds } },
          _avg: { progress: true },
        })
      : Promise.resolve([]),
    getBatchCourseRatingStats(courseIds),
    courseIds.length
      ? prisma.enrollment.findMany({
          where: { courseId: { in: courseIds } },
          include: {
            student: { select: { firstName: true, lastName: true } },
            course: { select: { title: true, slug: true } },
          },
          orderBy: { enrolledAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
  ])

  const progressMap = Object.fromEntries(
    progressByCourse.map((g) => [g.courseId, Math.round(g._avg.progress ?? 0)])
  )

  return {
    ...stats,
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      status: c.status,
      enrollmentCount: c._count.enrollments,
      averageRating: ratingStats[c.id]?.averageRating ?? 0,
      reviewCount: ratingStats[c.id]?.reviewCount ?? 0,
      avgProgress: progressMap[c.id] ?? 0,
    })),
    recentEnrollments: recentEnrollments.map((e) => ({
      enrollmentId: e.id,
      courseTitle: e.course.title,
      courseSlug: e.course.slug,
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      enrolledAt: e.enrolledAt.toISOString(),
      progress: e.progress,
    })),
  }
}

export async function getInstructorStats(userId: string) {
  const instructor = await requireInstructor(userId)
  const courseIds = await getInstructorCourseIds(instructor.id)
  return aggregateInstructorStats(instructor.id, courseIds)
}
