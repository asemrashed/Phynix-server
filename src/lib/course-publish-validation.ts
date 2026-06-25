import { parseQuizContent, quizContentSchema } from "@fxprime/types"
import { resolveLessonVideo } from "./video-source"

const PLACEHOLDER_TITLES = new Set([
  "new lesson",
  "untitled video lesson",
  "untitled reading",
  "untitled quiz",
])

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

type PublishLesson = {
  title: string
  type: string
  videoProvider: string | null
  videoRef: string | null
  content: string | null
  duration: number
  isFree: boolean
}

type PublishSection = {
  title: string
  lessons: PublishLesson[]
}

export type CoursePublishInput = {
  thumbnailUrl: string | null
  description: string
  price: number | { toString(): string }
  sections: PublishSection[]
}

export function getCoursePublishIssues(course: CoursePublishInput): string[] {
  const issues: string[] = []
  const lessons = course.sections.flatMap((s) => s.lessons)
  const price = Number(course.price)

  if (!course.thumbnailUrl?.trim()) issues.push("Course thumbnail is missing")
  if (stripHtml(course.description ?? "").length < 10) {
    issues.push("Description is too short (min 10 characters)")
  }
  if (course.sections.length === 0) issues.push("Add at least one section")
  if (lessons.length === 0) issues.push("Add at least one lesson")

  const emptySections = course.sections.filter((s) => s.lessons.length === 0)
  if (emptySections.length > 0) {
    issues.push(
      `${emptySections.length} empty section(s): ${emptySections.map((s) => `"${s.title}"`).join(", ")}`
    )
  }

  const zeroDuration = lessons.filter((l) => !l.duration || l.duration <= 0)
  if (zeroDuration.length > 0) {
    issues.push(`${zeroDuration.length} lesson(s) have no duration set`)
  }

  const placeholderTitles = lessons.filter((l) =>
    PLACEHOLDER_TITLES.has(l.title.trim().toLowerCase())
  )
  if (placeholderTitles.length > 0) {
    issues.push(`${placeholderTitles.length} lesson(s) still have placeholder titles`)
  }

  const videoMissing = lessons.filter((l) => {
    if (l.type !== "VIDEO") return false
    const { ref } = resolveLessonVideo(l)
    return !ref?.trim()
  })
  if (videoMissing.length > 0) {
    issues.push(`${videoMissing.length} video lesson(s) missing a video source`)
  }

  const textEmpty = lessons.filter(
    (l) => l.type === "TEXT" && !(l.content?.trim().length ?? 0)
  )
  if (textEmpty.length > 0) {
    issues.push(`${textEmpty.length} text lesson(s) have empty content`)
  }

  const invalidQuizzes = lessons.filter((l) => {
    if (l.type !== "QUIZ") return false
    const parsed = parseQuizContent(l.content)
    return !quizContentSchema.safeParse(parsed).success
  })
  if (invalidQuizzes.length > 0) {
    issues.push(`${invalidQuizzes.length} quiz lesson(s) have invalid or incomplete questions`)
  }

  const freePreviews = lessons.filter((l) => l.isFree)
  if (freePreviews.length > 3) {
    issues.push(
      `${freePreviews.length} free preview lessons — recommend max 2–3 intro videos`
    )
  }

  if (price === 0 && freePreviews.length === lessons.length && lessons.length > 0) {
    issues.push("All lessons are free preview — enroll has no value; lock some content")
  }

  return issues
}
