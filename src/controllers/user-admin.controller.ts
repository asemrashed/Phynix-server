import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  getAdminUserDetail,
  updateAdminUser,
  grantManualEnrollment,
  resetUserDeviceSessions,
} from "../services/user-admin.service"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"

const roleSchema = z.enum(["STUDENT", "ADMIN", "INSTRUCTOR"])

function handleUserError(err: unknown, res: Response, next: NextFunction) {
  const code = (err as { code?: string }).code
  if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
  if (code === "ALREADY_ENROLLED") return sendError(res, code, (err as Error).message, 400)
  if (code === "FORBIDDEN") return sendError(res, code, (err as Error).message, 403)
  return next(err)
}

export async function getUserDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getAdminUserDetail(param(req.params.userId))
    return sendSuccess(res, user)
  } catch (err) {
    return handleUserError(err, res, next)
  }
}

export async function patchUserDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      isActive: z.boolean().optional(),
      role: roleSchema.optional(),
    })
    const data = schema.parse(req.body)
    const user = await updateAdminUser(param(req.params.userId), data)
    return sendSuccess(res, user)
  } catch (err) {
    return handleUserError(err, res, next)
  }
}

export async function postUserEnrollment(req: Request, res: Response, next: NextFunction) {
  try {
    const { courseId } = z.object({ courseId: z.string().uuid() }).parse(req.body)
    const result = await grantManualEnrollment(param(req.params.userId), courseId)
    return sendSuccess(res, result, 201)
  } catch (err) {
    return handleUserError(err, res, next)
  }
}

export async function resetDeviceSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await resetUserDeviceSessions(param(req.params.userId))
    return sendSuccess(res, result)
  } catch (err) {
    return handleUserError(err, res, next)
  }
}
