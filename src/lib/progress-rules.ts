export const VIDEO_COMPLETE_RATIO = 0.9

export function shouldAutoCompleteVideo(
  watchPosition: number,
  duration: number
): boolean {
  return duration > 0 && watchPosition / duration >= VIDEO_COMPLETE_RATIO
}

export function resolveLessonCompletion(
  lessonType: string,
  input: {
    isCompleted?: boolean
    watchPosition?: number
    duration?: number
    existingCompleted?: boolean
  }
): boolean {
  if (input.existingCompleted) return true

  if (lessonType === "VIDEO") {
    if (input.isCompleted === true) return true
    if (
      input.watchPosition !== undefined &&
      input.duration !== undefined &&
      shouldAutoCompleteVideo(input.watchPosition, input.duration)
    ) {
      return true
    }
    return input.existingCompleted ?? false
  }

  if (lessonType === "TEXT") {
    return input.isCompleted === true
  }

  return input.isCompleted ?? input.existingCompleted ?? false
}

export function shouldLogLearningActivity(lessonType: string): boolean {
  return lessonType !== "QUIZ"
}
