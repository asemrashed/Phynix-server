import { Request, Response, NextFunction } from "express"
import { sendSuccess, sendError } from "../lib/response"
import { prisma } from "../lib/prisma"
import { getLearningGoals } from "../services/learning-goals.service"

export async function getMyLearningGoals(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }

    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
    })
    if (!student) {
      return sendError(res, "NOT_FOUND", "Student not found", 404)
    }

    const goals = await getLearningGoals(student.id)
    return sendSuccess(res, goals)
  } catch (err) {
    next(err)
  }
}
