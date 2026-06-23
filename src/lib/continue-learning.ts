type LessonRow = { id: string; title: string; order: number }
type SectionRow = { order: number; lessons: LessonRow[] }
type ProgressRow = { lessonId: string; isCompleted: boolean; watchPosition: number }

export interface ContinueLessonState {
  lastLessonId: string | null
  lastLessonTitle: string | null
  watchPosition: number
}

export function computeContinueLessonState(
  sections: SectionRow[],
  lessonProgress: ProgressRow[]
): ContinueLessonState {
  const progressMap = new Map(
    lessonProgress.map((lp) => [
      lp.lessonId,
      { isCompleted: lp.isCompleted, watchPosition: lp.watchPosition },
    ])
  )

  const orderedLessons = [...sections]
    .sort((a, b) => a.order - b.order)
    .flatMap((section) =>
      [...section.lessons].sort((a, b) => a.order - b.order)
    )

  if (orderedLessons.length === 0) {
    return { lastLessonId: null, lastLessonTitle: null, watchPosition: 0 }
  }

  const inProgress = [...orderedLessons]
    .reverse()
    .find((lesson) => {
      const progress = progressMap.get(lesson.id)
      return progress && !progress.isCompleted && progress.watchPosition > 0
    })

  if (inProgress) {
    const progress = progressMap.get(inProgress.id)!
    return {
      lastLessonId: inProgress.id,
      lastLessonTitle: inProgress.title,
      watchPosition: progress.watchPosition,
    }
  }

  const nextLesson = orderedLessons.find((lesson) => {
    const progress = progressMap.get(lesson.id)
    return !progress?.isCompleted
  })

  if (nextLesson) {
    const progress = progressMap.get(nextLesson.id)
    return {
      lastLessonId: nextLesson.id,
      lastLessonTitle: nextLesson.title,
      watchPosition: progress?.watchPosition ?? 0,
    }
  }

  const last = orderedLessons[orderedLessons.length - 1]
  return {
    lastLessonId: last.id,
    lastLessonTitle: last.title,
    watchPosition: progressMap.get(last.id)?.watchPosition ?? 0,
  }
}
