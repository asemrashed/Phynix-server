import { Request, Response, NextFunction } from "express"
import { getStudentAnalytics } from "../services/analytics.service"
import { sendSuccess, sendError } from "../lib/response"
import { getStudentId } from "../lib/student"

export async function getMyAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const analytics = await getStudentAnalytics(studentId)
    return sendSuccess(res, analytics)
  } catch (err) {
    next(err)
  }
}
