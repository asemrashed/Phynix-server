import {
  generateCertificate,
  handleCertificateGenerationFailure,
} from "../services/certificate.service"

async function runCertificateGeneration(
  studentId: string,
  courseId: string,
  userId: string
) {
  try {
    await generateCertificate(studentId, courseId, userId)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_COMPLETE") {
      console.warn(`[Certificate] Skipped — course not complete for ${studentId}/${courseId}`)
      return
    }
    console.error("[Certificate] Generation failed:", error.message)
    await handleCertificateGenerationFailure(studentId, courseId, userId, error)
  }
}

export async function queueCertificateGeneration(
  studentId: string,
  courseId: string,
  userId: string
) {
  await runCertificateGeneration(studentId, courseId, userId)
}
