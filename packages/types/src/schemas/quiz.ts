import { z } from "zod"

export const quizQuestionTypeSchema = z.enum(["SINGLE_CHOICE", "TRUE_FALSE"])

export const quizQuestionSchema = z
  .object({
    id: z.string().min(1),
    type: quizQuestionTypeSchema.default("SINGLE_CHOICE"),
    question: z.string().trim().min(1, "Question text is required"),
    options: z.array(z.string().trim().min(1)).min(2, "At least 2 options required"),
    correctIndex: z.number().int().min(0),
    explanation: z.string().optional(),
  })
  .refine((data) => data.correctIndex < data.options.length, {
    message: "Correct answer index is out of range",
    path: ["correctIndex"],
  })

export const quizContentSchema = z.object({
  passThreshold: z.number().min(0).max(100).default(70),
  maxAttempts: z.number().int().min(1).default(3),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  timeLimitSeconds: z.number().int().positive().optional(),
  questions: z.array(quizQuestionSchema).min(1, "Add at least one question"),
})

export type QuizQuestionType = z.infer<typeof quizQuestionTypeSchema>
export type QuizQuestionStored = z.infer<typeof quizQuestionSchema>
export type QuizContentStored = z.infer<typeof quizContentSchema>

/** Student-facing question (answers stripped) */
export interface QuizQuestionItem {
  id: string
  type: QuizQuestionType
  question: string
  options: string[]

  /** Present only after quiz is passed (review mode) */
  correctIndex?: number
  explanation?: string
}

export interface QuizLessonContent {
  passThreshold: number
  maxAttempts: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
  timeLimitSeconds?: number
  questions: QuizQuestionItem[]

  /** Present only after quiz is passed (review mode) */
  review?: {
    score: number
    results: QuizQuestionResultItem[]

    /** Stored student answers keyed by question id */
    answers?: Record<string, number>
  }
}

export interface QuizQuestionResultItem {
  questionId: string
  correct: boolean
  explanation?: string
  correctIndex?: number
}

export interface QuizSubmitResult {
  score: number
  passed: boolean
  correctCount: number
  total: number
  attemptsUsed: number
  attemptsRemaining: number
  perQuestion?: QuizQuestionResultItem[]

  /** Included when passed — same shape as review on lesson content */
  review?: QuizLessonContent["review"]
}

export function parseQuizContent(raw: string | null | undefined): QuizContentStored {
  if (!raw?.trim()) {
    return {
      passThreshold: 70,
      maxAttempts: 3,
      shuffleQuestions: false,
      shuffleOptions: false,
      questions: [],
    }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<QuizContentStored>
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.map((q) => ({
          id: String(q.id ?? ""),
          type: q.type === "TRUE_FALSE" ? ("TRUE_FALSE" as const) : ("SINGLE_CHOICE" as const),
          question: String(q.question ?? ""),
          options:
            q.type === "TRUE_FALSE"
              ? ["True", "False"]
              : Array.isArray(q.options)
                ? q.options.map(String)
                : ["", ""],
          correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
          explanation: q.explanation ? String(q.explanation) : undefined,
        }))
      : []

    return {
      passThreshold: parsed.passThreshold ?? 70,
      maxAttempts: parsed.maxAttempts ?? 3,
      shuffleQuestions: parsed.shuffleQuestions ?? false,
      shuffleOptions: parsed.shuffleOptions ?? false,
      timeLimitSeconds: parsed.timeLimitSeconds,
      questions,
    }
  } catch {
    return {
      passThreshold: 70,
      maxAttempts: 3,
      shuffleQuestions: false,
      shuffleOptions: false,
      questions: [],
    }
  }
}
