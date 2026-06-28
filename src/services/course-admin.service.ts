import type { Prisma } from "@prisma/client"
import type {
  AdminCourseDetail,
  AdminInstructorItem,
  AdminLessonItem,
  AdminSectionItem,
  CourseFaqItem,
  CourseLevel,
  CourseStatus,
  LessonType,
  VideoProvider,
} from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { ensureInstructorProfiles } from "./role-profile.service"
import { listCourseReviews } from "./review.service"
import { parseYoutubeId } from "../lib/video-source"
import { parseCourseFaqs } from "../lib/course-marketing"
import { getCoursePublishIssues } from "../lib/course-publish-validation"

const courseDetailInclude = {
  instructor: true,
  sections: {
    orderBy: { order: "asc" as const },
    include: { lessons: { orderBy: { order: "asc" as const } } },
  },
  _count: { select: { enrollments: true } },
}

export async function resolveCourseId(idOrSlug: string): Promise<string> {
  const byId = await prisma.course.findUnique({
    where: { id: idOrSlug },
    select: { id: true },
  })
  if (byId) return byId.id

  const bySlug = await prisma.course.findUnique({
    where: { slug: idOrSlug },
    select: { id: true },
  })
  if (!bySlug) {
    throw Object.assign(new Error("Course not found"), { code: "NOT_FOUND" })
  }
  return bySlug.id
}

async function recomputeCourseDuration(courseId: string) {
  const lessons = await prisma.lesson.findMany({
    where: { section: { courseId } },
    select: { duration: true },
  })
  const totalDuration = lessons.reduce((sum, l) => sum + l.duration, 0)
  await prisma.course.update({
    where: { id: courseId },
    data: { totalDuration },
  })
}

function normalizeVideoInput(data: {
  videoProvider?: VideoProvider
  videoRef?: string | null
}): { videoProvider: VideoProvider; videoRef: string | null } {
  const provider = data.videoProvider ?? "YOUTUBE"
  let videoRef = data.videoRef?.trim() || null

  if (provider === "YOUTUBE") {
    videoRef = videoRef ? parseYoutubeId(videoRef) : null
  }

  return { videoProvider: provider, videoRef }
}

function mapLesson(lesson: {
  id: string
  title: string
  type: string
  videoProvider: string
  videoRef: string | null
  content: string | null
  duration: number
  order: number
  isFree: boolean
}): AdminLessonItem {
  return {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type as LessonType,
    videoProvider: (lesson.videoProvider as VideoProvider) || "YOUTUBE",
    videoRef: lesson.videoRef,
    content: lesson.content,
    duration: lesson.duration,
    order: lesson.order,
    isFree: lesson.isFree,
  }
}

function mapSection(section: {
  id: string
  title: string
  order: number
  lessons: Array<{
    id: string
    title: string
    type: string
    videoProvider: string
    videoRef: string | null
    content: string | null
    duration: number
    order: number
    isFree: boolean
  }>
}): AdminSectionItem {
  return {
    id: section.id,
    title: section.title,
    order: section.order,
    lessons: section.lessons.map(mapLesson),
  }
}

export async function listInstructors(): Promise<AdminInstructorItem[]> {
  await ensureInstructorProfiles()

  const instructors = await prisma.instructor.findMany({
    where: {
      user: {
        isActive: true,
        role: { in: ["INSTRUCTOR", "ADMIN", "SUPER_ADMIN"] },
      },
    },
    orderBy: { displayName: "asc" },
  })
  return instructors.map((i) => ({
    id: i.id,
    displayName: i.displayName,
    photoUrl: i.photoUrl,
  }))
}

export async function getAdminCourseDetail(idOrSlug: string): Promise<AdminCourseDetail> {
  const course =
    (await prisma.course.findUnique({
      where: { id: idOrSlug },
      include: courseDetailInclude,
    })) ??
    (await prisma.course.findUnique({
      where: { slug: idOrSlug },
      include: courseDetailInclude,
    }))

  if (!course) {
    throw Object.assign(new Error("Course not found"), { code: "NOT_FOUND" })
  }

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
    startsAt: course.startsAt?.toISOString() ?? null,
    classSchedule: course.classSchedule,
    deliveryType: course.deliveryType,
    refundDays: course.refundDays,
    learningOutcomes: course.learningOutcomes,
    thumbnailUrl: course.thumbnailUrl,
    price: Number(course.price),
    originalPrice: course.originalPrice ? Number(course.originalPrice) : null,
    currency: course.currency,
    level: course.level as CourseLevel,
    language: course.language,
    instructorId: course.instructorId,
    instructorName: course.instructor.displayName,
    status: course.status as CourseStatus,
    isFeatured: course.isFeatured,
    totalDuration: course.totalDuration,
    enrollmentCount: course._count.enrollments,
    publishedAt: course.publishedAt?.toISOString() ?? null,
    createdAt: course.createdAt.toISOString(),
    sections: course.sections.map(mapSection),
  }
}

type CourseMarketingInput = {
  subtitle?: string | null
  badgeLabel?: string | null
  highlights?: string[]
  faqs?: CourseFaqItem[]
  discountEndsAt?: string | null
  seatLimit?: number | null
  startsAt?: string | null
  classSchedule?: string | null
  deliveryType?: string | null
  refundDays?: number | null
}

function mapMarketingInput(data: CourseMarketingInput) {
  const mapped: Record<string, unknown> = {}

  if (data.subtitle !== undefined) mapped.subtitle = data.subtitle?.trim() || null
  if (data.badgeLabel !== undefined) mapped.badgeLabel = data.badgeLabel?.trim() || null
  if (data.highlights !== undefined) mapped.highlights = data.highlights
  if (data.faqs !== undefined) mapped.faqs = data.faqs
  if (data.discountEndsAt !== undefined) {
    mapped.discountEndsAt = data.discountEndsAt ? new Date(data.discountEndsAt) : null
  }
  if (data.seatLimit !== undefined) mapped.seatLimit = data.seatLimit
  if (data.startsAt !== undefined) {
    mapped.startsAt = data.startsAt ? new Date(data.startsAt) : null
  }
  if (data.classSchedule !== undefined) {
    mapped.classSchedule = data.classSchedule?.trim() || null
  }
  if (data.deliveryType !== undefined) {
    mapped.deliveryType = data.deliveryType?.trim() || null
  }
  if (data.refundDays !== undefined) mapped.refundDays = data.refundDays

  return mapped
}

function slugifyTitle(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

function resolveCourseSlug(title: string, slug?: string): string {
  const candidate = (slug?.trim() || slugifyTitle(title)).replace(/^-+|-+$/g, "")
  if (candidate.length >= 3) return candidate
  const prefix = candidate.length > 0 ? candidate : "draft"
  return `${prefix}-${Date.now().toString(36)}`
}

export async function resolveDefaultInstructorId(): Promise<string> {
  const instructors = await listInstructors()
  if (instructors.length === 0) {
    throw Object.assign(new Error("No instructor profile available"), { code: "NO_INSTRUCTOR" })
  }
  return instructors[0].id
}

export async function createCourse(data: {
  title: string
  slug?: string
  description?: string
  subtitle?: string
  badgeLabel?: string
  highlights?: string[]
  faqs?: CourseFaqItem[]
  discountEndsAt?: string
  seatLimit?: number
  startsAt?: string
  classSchedule?: string
  deliveryType?: string
  refundDays?: number
  learningOutcomes?: string[]
  thumbnailUrl?: string
  price?: number
  originalPrice?: number
  currency?: string
  level?: CourseLevel
  language?: string
  instructorId?: string
}) {
  const slug = resolveCourseSlug(data.title, data.slug)
  const existing = await prisma.course.findUnique({ where: { slug } })
  if (existing) {
    throw Object.assign(new Error("Slug already exists"), { code: "SLUG_EXISTS" })
  }

  const instructorId = data.instructorId ?? (await resolveDefaultInstructorId())
  const instructor = await prisma.instructor.findUnique({ where: { id: instructorId } })
  if (!instructor) {
    throw Object.assign(new Error("Instructor not found"), { code: "NOT_FOUND" })
  }

  const course = await prisma.course.create({
    data: {
      title: data.title.trim(),
      slug,
      description: data.description?.trim() ?? "",
      learningOutcomes: data.learningOutcomes ?? [],
      ...mapMarketingInput(data),
      thumbnailUrl: data.thumbnailUrl,
      price: data.price ?? 0,
      originalPrice: data.originalPrice,
      currency: data.currency || "BDT",
      level: data.level ?? "BEGINNER",
      language: data.language ?? "ENGLISH",
      instructorId,
      status: "DRAFT",
    },
  })

  return getAdminCourseDetail(course.id)
}

export async function updateCourse(
  idOrSlug: string,
  data: {
    title?: string
    slug?: string
    description?: string
    subtitle?: string | null
    badgeLabel?: string | null
    highlights?: string[]
    faqs?: CourseFaqItem[]
    discountEndsAt?: string | null
    seatLimit?: number | null
    startsAt?: string | null
    classSchedule?: string | null
    deliveryType?: string | null
    refundDays?: number | null
    learningOutcomes?: string[]
    thumbnailUrl?: string | null
    price?: number
    originalPrice?: number | null
    currency?: string
    level?: CourseLevel
    language?: string
    instructorId?: string
    status?: CourseStatus
    isFeatured?: boolean
  }
) {
  const courseId = await resolveCourseId(idOrSlug)
  const course = await prisma.course.findUnique({ where: { id: courseId } })
  if (!course) {
    throw Object.assign(new Error("Course not found"), { code: "NOT_FOUND" })
  }

  if (data.slug && data.slug !== course.slug) {
    const existing = await prisma.course.findUnique({ where: { slug: data.slug } })
    if (existing) {
      throw Object.assign(new Error("Slug already exists"), { code: "SLUG_EXISTS" })
    }
  }

  if (data.instructorId) {
    const instructor = await prisma.instructor.findUnique({ where: { id: data.instructorId } })
    if (!instructor) {
      throw Object.assign(new Error("Instructor not found"), { code: "NOT_FOUND" })
    }
  }

  if (data.status === "PUBLISHED" && course.status !== "PUBLISHED") {
    const fullCourse = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: { lessons: { orderBy: { order: "asc" } } },
        },
      },
    })
    if (!fullCourse) {
      throw Object.assign(new Error("Course not found"), { code: "NOT_FOUND" })
    }

    const publishIssues = getCoursePublishIssues({
      thumbnailUrl: data.thumbnailUrl ?? fullCourse.thumbnailUrl,
      description: data.description ?? fullCourse.description,
      price: data.price ?? fullCourse.price,
      sections: fullCourse.sections,
    })
    if (publishIssues.length > 0) {
      throw Object.assign(new Error(publishIssues[0]), {
        code: "PUBLISH_BLOCKED",
        issues: publishIssues,
      })
    }
  }

  const publishedAt =
    data.status === "PUBLISHED"
      ? course.publishedAt ?? new Date()
      : data.status === "DRAFT"
        ? null
        : undefined

  await prisma.course.update({
    where: { id: courseId },
    data: {
      title: data.title,
      slug: data.slug,
      description: data.description,
      learningOutcomes: data.learningOutcomes,
      ...mapMarketingInput(data),
      thumbnailUrl: data.thumbnailUrl,
      price: data.price,
      originalPrice: data.originalPrice,
      currency: data.currency,
      level: data.level,
      language: data.language,
      instructorId: data.instructorId,
      status: data.status,
      isFeatured: data.isFeatured,
      publishedAt,
    },
  })

  return getAdminCourseDetail(courseId)
}

export async function deleteCourse(idOrSlug: string) {
  const courseId = await resolveCourseId(idOrSlug)
  await prisma.course.delete({ where: { id: courseId } })
  return { deleted: true }
}

export async function createSection(idOrSlug: string, title: string) {
  const courseId = await resolveCourseId(idOrSlug)

  const maxOrder = await prisma.section.aggregate({
    where: { courseId },
    _max: { order: true },
  })

  const section = await prisma.section.create({
    data: {
      courseId,
      title,
      order: (maxOrder._max.order ?? 0) + 1,
    },
    include: { lessons: true },
  })

  return mapSection(section)
}

export async function updateSection(sectionId: string, data: { title?: string }) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } })
  if (!section) {
    throw Object.assign(new Error("Section not found"), { code: "NOT_FOUND" })
  }

  const updated = await prisma.section.update({
    where: { id: sectionId },
    data: { title: data.title },
    include: { lessons: { orderBy: { order: "asc" } } },
  })

  return mapSection(updated)
}

export async function deleteSection(sectionId: string) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } })
  if (!section) {
    throw Object.assign(new Error("Section not found"), { code: "NOT_FOUND" })
  }

  await prisma.section.delete({ where: { id: sectionId } })
  await recomputeCourseDuration(section.courseId)
  return { deleted: true }
}

export async function reorderSections(idOrSlug: string, orderedIds: string[]) {
  const courseId = await resolveCourseId(idOrSlug)
  const sections = await prisma.section.findMany({ where: { courseId } })
  if (sections.length !== orderedIds.length) {
    throw Object.assign(new Error("Invalid section order"), { code: "INVALID_ORDER" })
  }

  const sectionIds = new Set(sections.map((s) => s.id))
  for (const id of orderedIds) {
    if (!sectionIds.has(id)) {
      throw Object.assign(new Error("Invalid section id"), { code: "INVALID_ORDER" })
    }
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.section.update({ where: { id }, data: { order: index + 1 } })
    )
  )

  const course = await getAdminCourseDetail(courseId)
  return course.sections
}

export async function createLesson(
  sectionId: string,
  data: {
    title: string
    type: LessonType
    videoProvider?: VideoProvider
    videoRef?: string
    content?: string
    duration?: number
    isFree?: boolean
  }
) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } })
  if (!section) {
    throw Object.assign(new Error("Section not found"), { code: "NOT_FOUND" })
  }

  const maxOrder = await prisma.lesson.aggregate({
    where: { sectionId },
    _max: { order: true },
  })

  const video =
    data.type === "VIDEO"
      ? normalizeVideoInput(data)
      : { videoProvider: "YOUTUBE" as VideoProvider, videoRef: null }

  const lesson = await prisma.lesson.create({
    data: {
      sectionId,
      title: data.title,
      type: data.type,
      videoProvider: video.videoProvider,
      videoRef: video.videoRef,
      content: data.type !== "VIDEO" ? data.content : data.content ?? null,
      duration: data.duration ?? 0,
      order: (maxOrder._max.order ?? 0) + 1,
      isFree: data.isFree ?? false,
    },
  })

  await recomputeCourseDuration(section.courseId)
  return mapLesson(lesson)
}

export async function updateLesson(
  lessonId: string,
  data: {
    title?: string
    type?: LessonType
    videoProvider?: VideoProvider
    videoRef?: string | null
    content?: string | null
    duration?: number
    isFree?: boolean
  }
) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: true },
  })
  if (!lesson) {
    throw Object.assign(new Error("Lesson not found"), { code: "NOT_FOUND" })
  }

  const type = data.type ?? (lesson.type as LessonType)
  const video =
    type === "VIDEO"
      ? normalizeVideoInput({
          videoProvider: data.videoProvider ?? (lesson.videoProvider as VideoProvider),
          videoRef: data.videoRef ?? lesson.videoRef,
        })
      : { videoProvider: "YOUTUBE" as VideoProvider, videoRef: null }

  const updated = await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      title: data.title,
      type,
      videoProvider: video.videoProvider,
      videoRef: video.videoRef,
      content: type !== "VIDEO" ? (data.content ?? lesson.content) : null,
      duration: data.duration,
      isFree: data.isFree,
    },
  })

  await recomputeCourseDuration(lesson.section.courseId)
  return mapLesson(updated)
}

export async function deleteLesson(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: true },
  })
  if (!lesson) {
    throw Object.assign(new Error("Lesson not found"), { code: "NOT_FOUND" })
  }

  await prisma.lesson.delete({ where: { id: lessonId } })
  await recomputeCourseDuration(lesson.section.courseId)
  return { deleted: true }
}

export async function reorderLessons(sectionId: string, orderedIds: string[]) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } })
  if (!section) {
    throw Object.assign(new Error("Section not found"), { code: "NOT_FOUND" })
  }

  const lessons = await prisma.lesson.findMany({ where: { sectionId } })
  if (lessons.length !== orderedIds.length) {
    throw Object.assign(new Error("Invalid lesson order"), { code: "INVALID_ORDER" })
  }

  const lessonIds = new Set(lessons.map((l) => l.id))
  for (const id of orderedIds) {
    if (!lessonIds.has(id)) {
      throw Object.assign(new Error("Invalid lesson id"), { code: "INVALID_ORDER" })
    }
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.lesson.update({ where: { id }, data: { order: index + 1 } })
    )
  )

  const updated = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { lessons: { orderBy: { order: "asc" } } },
  })

  return updated!.lessons.map(mapLesson)
}

export async function getAdminCourseStudents(
  idOrSlug: string,
  opts: { page?: number; limit?: number; search?: string } = {}
) {
  const courseId = await resolveCourseId(idOrSlug)

  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20))
  const skip = (page - 1) * limit
  const search = opts.search?.trim()

  const where: Prisma.EnrollmentWhereInput = { courseId }
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            uniqueStudentId: true,
            userId: true,
          },
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
      studentId: e.student.uniqueStudentId,
      studentUserId: e.student.userId,
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      enrolledAt: e.enrolledAt.toISOString(),
      progress: e.progress,
      completedAt: e.completedAt?.toISOString() ?? null,
    })),
    total,
    page,
    limit,
  }
}

export async function getAdminCourseReviews(idOrSlug: string, limit = 50) {
  const courseId = await resolveCourseId(idOrSlug)
  return listCourseReviews(courseId, limit)
}
