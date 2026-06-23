import { prisma } from "./prisma"
import { AppError } from "./errors"

export async function getStudentId(userId: string): Promise<string | null> {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  })
  return student?.id ?? null
}

export async function requireStudentId(userId: string): Promise<string> {
  const studentId = await getStudentId(userId)
  if (!studentId) {
    throw new AppError("FORBIDDEN", "Student profile required", 403)
  }
  return studentId
}
