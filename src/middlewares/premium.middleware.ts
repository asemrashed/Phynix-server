import { Request, Response, NextFunction } from "express"
import { sendError } from "../lib/response"
import { getStudentId } from "../lib/student"
import { canAccessPremiumContent } from "../services/access-control.service"

export async function requirePremiumAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
  }

  const studentId = await getStudentId(req.user.userId)
  const allowed = await canAccessPremiumContent({
    studentId,
    role: req.user.role,
  })

  if (!allowed) {
    return sendError(
      res,
      "PREMIUM_REQUIRED",
      "A PRO or Lifetime subscription is required to access this content",
      403
    )
  }

  next()
}
