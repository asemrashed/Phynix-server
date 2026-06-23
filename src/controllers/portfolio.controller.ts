import { Request, Response, NextFunction } from "express"
import { sendSuccess, sendError } from "../lib/response"
import { prisma } from "../lib/prisma"
import { getStudentPortfolio } from "../services/portfolio.service"

export async function getMyPortfolio(req: Request, res: Response, next: NextFunction) {
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

    const portfolio = await getStudentPortfolio(student.id)
    return sendSuccess(res, portfolio)
  } catch (err) {
    next(err)
  }
}
