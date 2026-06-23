import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import type { Role } from "@fxprime/types"
import { sendError } from "../lib/response"

export interface AuthPayload {
  userId: string
  role: Role
  sessionId: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as AuthPayload
    req.user = payload
    next()
  } catch {
    return sendError(res, "TOKEN_EXPIRED", "Access token expired or invalid", 401)
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, "FORBIDDEN", "Insufficient permissions", 403)
    }
    next()
  }
}

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(
        header.slice(7),
        process.env.JWT_SECRET!
      ) as AuthPayload
      req.user = payload
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next()
}
