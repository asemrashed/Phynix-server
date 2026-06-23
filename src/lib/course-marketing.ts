import type { CourseFaqItem } from "@fxprime/types"

export function parseCourseFaqs(value: unknown): CourseFaqItem[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (item): item is CourseFaqItem =>
        !!item &&
        typeof item === "object" &&
        typeof (item as CourseFaqItem).question === "string" &&
        typeof (item as CourseFaqItem).answer === "string"
    )
    .map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    }))
    .filter((item) => item.question.length > 0 && item.answer.length > 0)
}
