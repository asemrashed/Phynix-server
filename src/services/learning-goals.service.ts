import type { LearningGoals } from "@fxprime/types"
import { getCached, setCached } from "../lib/cache"
import { prisma } from "../lib/prisma"

const WEEKLY_GOAL_HOURS = 5
const ACTIVE_TYPES = new Set([
  "LESSON_COMPLETED",
  "LESSON_PAUSED",
  "QUIZ_COMPLETED",
])

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function getLearningGoals(studentId: string): Promise<LearningGoals> {
  const cacheKey = `learning_goals:${studentId}`
  const cached = await getCached<LearningGoals>(cacheKey)
  if (cached) return cached

  const since = new Date()
  since.setDate(since.getDate() - 90)

  const activities = await prisma.learningActivity.findMany({
    where: { studentId, createdAt: { gte: since } },
    select: { createdAt: true, type: true, metadata: true },
    orderBy: { createdAt: "desc" },
  })

  const daysWithActivity = new Set<string>()
  const minutesByDay: Record<string, number> = {}

  for (const act of activities) {
    if (!ACTIVE_TYPES.has(act.type)) continue
    const key = dateKey(act.createdAt)
    daysWithActivity.add(key)
    const mins =
      ((act.metadata as { watchPosition?: number })?.watchPosition ?? 300) / 60
    minutesByDay[key] = (minutesByDay[key] ?? 0) + mins
  }

  let currentStreak = 0
  const checkDate = new Date()
  const todayKey = dateKey(checkDate)
  if (!daysWithActivity.has(todayKey)) {
    checkDate.setDate(checkDate.getDate() - 1)
  }

  while (daysWithActivity.has(dateKey(checkDate))) {
    currentStreak++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  let longestStreak = 0
  let run = 0
  const sortedDays = [...daysWithActivity].sort()
  for (let i = 0; i < sortedDays.length; i++) {
    if (i === 0) {
      run = 1
    } else {
      const prev = new Date(sortedDays[i - 1])
      const curr = new Date(sortedDays[i])
      const diffDays = Math.round(
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      )
      run = diffDays === 1 ? run + 1 : 1
    }
    longestStreak = Math.max(longestStreak, run)
  }

  const weeklyActivity = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = dateKey(d)
    weeklyActivity.push({
      date: key,
      active: daysWithActivity.has(key),
      minutes: Math.round(minutesByDay[key] ?? 0),
    })
  }

  const weekStart = getWeekStart(new Date())
  let weeklyMinutes = 0
  for (const [day, mins] of Object.entries(minutesByDay)) {
    if (new Date(day) >= weekStart) {
      weeklyMinutes += mins
    }
  }

  const goals: LearningGoals = {
    currentStreak,
    longestStreak,
    weeklyGoalHours: WEEKLY_GOAL_HOURS,
    weeklyProgressHours: Math.round((weeklyMinutes / 60) * 10) / 10,
    weeklyActivity,
  }

  await setCached(cacheKey, goals, 60)
  return goals
}
