import type { PrismaClient, Role } from "@prisma/client"

export async function upsertStudentUser(
  prisma: PrismaClient,
  opts: {
    email: string
    passwordHash: string
    role: Role
    firstName: string
    lastName: string
    phone?: string
    country?: string
    avatarUrl?: string
    uniqueStudentId?: string
    registrationType?: string
  }
) {
  const existing = await prisma.user.findUnique({
    where: { email: opts.email },
    include: { student: true },
  })

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        role: opts.role,
        isVerified: true,
        passwordHash: opts.passwordHash,
        student: existing.student
          ? {
              update: {
                firstName: opts.firstName,
                lastName: opts.lastName,
                phone: opts.phone,
                country: opts.country ?? "Bangladesh",
                avatarUrl: opts.avatarUrl,
                uniqueStudentId: opts.uniqueStudentId ?? existing.student.uniqueStudentId,
                registrationType: opts.registrationType ?? "STUDENT",
              },
            }
          : {
              create: {
                firstName: opts.firstName,
                lastName: opts.lastName,
                phone: opts.phone,
                country: opts.country ?? "Bangladesh",
                avatarUrl: opts.avatarUrl,
                uniqueStudentId: opts.uniqueStudentId,
                registrationType: opts.registrationType ?? "STUDENT",
              },
            },
      },
      include: { student: true },
    })
  }

  return prisma.user.create({
    data: {
      email: opts.email,
      passwordHash: opts.passwordHash,
      role: opts.role,
      isVerified: true,
      student: {
        create: {
          firstName: opts.firstName,
          lastName: opts.lastName,
          phone: opts.phone,
          country: opts.country ?? "Bangladesh",
          avatarUrl: opts.avatarUrl,
          uniqueStudentId: opts.uniqueStudentId,
          registrationType: opts.registrationType ?? "STUDENT",
        },
      },
    },
    include: { student: true },
  })
}

export async function getCourseLessonCount(
  prisma: PrismaClient,
  courseSlug: string
): Promise<number> {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    include: { sections: { include: { lessons: true } } },
  })
  if (!course) return 0
  return course.sections.flatMap((s) => s.lessons).length
}

export async function seedEnrollmentWithLessons(
  prisma: PrismaClient,
  studentId: string,
  courseSlug: string,
  opts: {
    progress?: number
    completedLessons: number
    partialWatchPosition?: number
    completedAt?: Date | null
    certificateStatus?: string | null
  }
) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
    },
  })
  if (!course) return null

  const lessons = course.sections.flatMap((s) => s.lessons)
  const progress =
    opts.progress ??
    (lessons.length > 0
      ? Math.round((opts.completedLessons / lessons.length) * 100)
      : 0)

  const enrollment = await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId, courseId: course.id } },
    update: {
      progress,
      completedAt: opts.completedAt ?? null,
      certificateStatus: opts.certificateStatus ?? null,
    },
    create: {
      studentId,
      courseId: course.id,
      progress,
      completedAt: opts.completedAt ?? null,
      certificateStatus: opts.certificateStatus ?? null,
    },
  })

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i]
    const isCompleted = i < opts.completedLessons
    const isPartial =
      i === opts.completedLessons && opts.partialWatchPosition !== undefined

    await prisma.lessonProgress.upsert({
      where: {
        enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: lesson.id },
      },
      update: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        watchPosition: isCompleted
          ? lesson.duration || 900
          : isPartial
            ? opts.partialWatchPosition!
            : 0,
      },
      create: {
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        watchPosition: isCompleted
          ? lesson.duration || 900
          : isPartial
            ? opts.partialWatchPosition!
            : 0,
      },
    })
  }

  return { enrollment, course, lessons }
}

export function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(10, 0, 0, 0)
  return d
}

export function daysFromNow(days: number, hour = 14): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d
}

type SyncLesson = {
  title: string
  type: "VIDEO" | "TEXT" | "QUIZ"
  duration: number
  order: number
  isFree?: boolean
  content?: string
  videoProvider?: "YOUTUBE" | "VIMEO"
  videoRef?: string
}

export async function syncCourseSections(
  prisma: PrismaClient,
  courseId: string,
  sections: Array<{ title: string; order: number; lessons: SyncLesson[] }>
) {
  for (const sectionData of sections) {
    let section = await prisma.section.findFirst({
      where: { courseId, order: sectionData.order },
    })

    if (section) {
      section = await prisma.section.update({
        where: { id: section.id },
        data: { title: sectionData.title },
      })
    } else {
      section = await prisma.section.create({
        data: { courseId, title: sectionData.title, order: sectionData.order },
      })
    }

    for (const lessonData of sectionData.lessons) {
      const existingLesson = await prisma.lesson.findFirst({
        where: { sectionId: section.id, order: lessonData.order },
      })

      const lessonFields = {
        title: lessonData.title,
        type: lessonData.type,
        duration: lessonData.duration,
        isFree: lessonData.isFree ?? false,
        content: lessonData.content ?? null,
        videoProvider: lessonData.videoProvider ?? "VIMEO",
        videoRef: lessonData.videoRef ?? null,
      }

      if (existingLesson) {
        await prisma.lesson.update({
          where: { id: existingLesson.id },
          data: lessonFields,
        })
      } else {
        await prisma.lesson.create({
          data: { sectionId: section.id, order: lessonData.order, ...lessonFields },
        })
      }
    }

    const seedOrders = sectionData.lessons.map((lesson) => lesson.order)
    await prisma.lesson.deleteMany({
      where: {
        sectionId: section.id,
        order: { notIn: seedOrders },
      },
    })
  }
}
