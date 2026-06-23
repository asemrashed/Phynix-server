import { Request, Response, NextFunction } from "express"
import { sendError } from "../lib/response"
import { prisma } from "../lib/prisma"
import {
  bypassesEmailVerification,
  isEmailVerificationEnforced,
} from "../lib/email-verification"

export async function requireEmailVerified(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!isEmailVerificationEnforced()) {
    return next()
  }

  if (!req.user) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
  }

  if (bypassesEmailVerification(req.user.role)) {
    return next()
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { isVerified: true },
  })

  if (!user?.isVerified) {
    return sendError(
      res,
      "EMAIL_NOT_VERIFIED",
      "Please verify your email before completing this action",
      403
    )
  }

  next()
}
