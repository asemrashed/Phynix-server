import { prisma } from "../lib/prisma"

export async function getStudentAnalytics(studentId: string) {
  const [activities, enrollments, purchases] = await Promise.all([
    prisma.learningActivity.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.enrollment.findMany({
      where: { studentId },
      include: { course: true },
    }),
    prisma.productPurchase.count({ where: { studentId } }),
  ])

  const lessonCompleted = activities.filter((a) => a.type === "LESSON_COMPLETED").length
  const totalLessons = enrollments.reduce((sum, e) => sum + (e.progress > 0 ? 1 : 0), 0)
  const completedCourses = enrollments.filter((e) => e.progress === 100).length

  const weeklyHours: Record<string, number> = {}
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    weeklyHours[key] = 0
  }

  for (const act of activities) {
    const key = act.createdAt.toISOString().slice(0, 10)
    if (weeklyHours[key] !== undefined) {
      const mins = (act.metadata as { watchPosition?: number })?.watchPosition ?? 300
      weeklyHours[key] += mins / 3600
    }
  }

  const recentLessons = activities
    .filter((a) => a.type === "LESSON_COMPLETED" || a.type === "LESSON_PAUSED")
    .slice(0, 5)
    .map((a) => ({
      type: a.type,
      entityId: a.entityId,
      createdAt: a.createdAt.toISOString(),
    }))

  return {
    totalLessonsCompleted: lessonCompleted,
    coursesEnrolled: enrollments.length,
    coursesCompleted: completedCourses,
    productsPurchased: purchases,
    weeklyActivity: Object.entries(weeklyHours).map(([date, hours]) => ({
      date,
      hours: Math.round(hours * 10) / 10,
    })),
    courseProgress: enrollments.map((e) => ({
      courseTitle: e.course.title,
      progress: e.progress,
    })),
    recentLessons,
  }
}
