import { randomUUID } from "crypto"
import type {
  QuizContentStored,
  QuizQuestionResultItem,
  QuizQuestionStored,
  QuizSubmitResult,
} from "@fxprime/types"
import {
  parseQuizContent as parseQuizContentFromTypes,
  quizContentSchema,
} from "@fxprime/types"
import { prisma } from "../lib/prisma"

const QUIZ_ACTIVITY_TYPES = ["QUIZ_COMPLETED", "QUIZ_ATTEMPT"] as const

export type { QuizContentStored, QuizQuestionStored }

export function parseQuizContent(raw: string | null): QuizContentStored {
  const parsed = parseQuizContentFromTypes(raw)
  if (parsed.questions.length === 0 && !raw?.trim()) {
    return parsed
  }

  return {
    ...parsed,
    questions: parsed.questions.map((q: QuizQuestionStored) =>
      q.id ? q : { ...q, id: randomUUID() }
    ),
  }
}

export function validateQuizContent(raw: string | null): {
  valid: boolean
  errors: string[]

  /** Parsed content when structurally usable (may still be invalid for publish) */
  content: QuizContentStored
} {
  const content = parseQuizContent(raw)
  const result = quizContentSchema.safeParse(content)
  if (result.success) {
    return { valid: true, errors: [], content: result.data }
  }

  const errors = result.error.issues.map((issue: { message: string }) => issue.message)
  return { valid: false, errors, content }
}

export function stripQuizAnswers(quiz: QuizContentStored) {
  return {
    passThreshold: quiz.passThreshold ?? 70,
    maxAttempts: quiz.maxAttempts ?? 3,
    shuffleQuestions: quiz.shuffleQuestions ?? false,
    shuffleOptions: quiz.shuffleOptions ?? false,
    timeLimitSeconds: quiz.timeLimitSeconds,
    questions: quiz.questions.map(({ id, type, question, options }: QuizQuestionStored) => ({
      id,
      type: type ?? "SINGLE_CHOICE",
      question,
      options,
    })),
  }
}

export function buildQuizReview(
  quiz: QuizContentStored,
  answers: Record<string, number>,
  score: number
) {
  const results = buildPerQuestionResults(quiz, answers, true)
  return {
    score,
    results,
    answers,
  }
}

export function gradeQuiz(
  quiz: QuizContentStored,
  answers: Record<string, number>
): QuizSubmitResult {
  if (!quiz.questions.length) {
    return {
      score: 0,
      passed: false,
      correctCount: 0,
      total: 0,
      attemptsUsed: 0,
      attemptsRemaining: 0,
      perQuestion: [],
    }
  }

  const perQuestion = buildPerQuestionResults(quiz, answers, false)
  const correctCount = perQuestion.filter((r) => r.correct).length
  const score = Math.round((correctCount / quiz.questions.length) * 100)
  const passed = score >= (quiz.passThreshold ?? 70)

  const result: QuizSubmitResult = {
    score,
    passed,
    correctCount,
    total: quiz.questions.length,
    attemptsUsed: 0,
    attemptsRemaining: 0,
    perQuestion,
  }

  if (passed) {
    result.review = buildQuizReview(quiz, answers, score)
  }

  return result
}

function buildPerQuestionResults(
  quiz: QuizContentStored,
  answers: Record<string, number>,
  includeCorrectIndex: boolean
): QuizQuestionResultItem[] {
  return quiz.questions.map((q: QuizQuestionStored) => {
    const correct = answers[q.id] === q.correctIndex
    return {
      questionId: q.id,
      correct,
      explanation: q.explanation,
      ...(includeCorrectIndex ? { correctIndex: q.correctIndex } : {}),
    }
  })
}

export async function countQuizAttempts(
  studentId: string,
  lessonId: string
): Promise<number> {
  return prisma.learningActivity.count({
    where: {
      studentId,
      entityId: lessonId,
      type: { in: [...QUIZ_ACTIVITY_TYPES] },
    },
  })
}

export async function getLatestQuizActivity(
  studentId: string,
  lessonId: string
) {
  return prisma.learningActivity.findFirst({
    where: {
      studentId,
      entityId: lessonId,
      type: { in: [...QUIZ_ACTIVITY_TYPES] },
    },
    orderBy: { createdAt: "desc" },
  })
}

export function enrichStudentQuizContent(
  quiz: QuizContentStored,
  reviewMeta: Record<string, unknown> | null
) {
  const stripped = stripQuizAnswers(quiz)

  if (!reviewMeta?.review || typeof reviewMeta.review !== "object") {
    return stripped
  }

  const review = reviewMeta.review as {
    score?: number
    results?: QuizQuestionResultItem[]

    answers?: Record<string, number>
  }

  return {
    ...stripped,
    questions: stripped.questions.map((q) => {
      const result = review.results?.find((r) => r.questionId === q.id)
      const stored = quiz.questions.find((item) => item.id === q.id)
      return {
        ...q,
        explanation: stored?.explanation,
        correctIndex: result?.correctIndex,
      }
    }),
    review: {
      score: typeof review.score === "number" ? review.score : 0,
      results: Array.isArray(review.results) ? review.results : [],
      answers:
        review.answers && typeof review.answers === "object"
          ? review.answers
          : undefined,
    },
  }
}
