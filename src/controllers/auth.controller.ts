import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  forceLogoutDevice,
  getUserById,
  updateStudentProfile,
  updateStudentAvatar,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  sendEmailVerification,
} from "../services/auth.service"
import { sendSuccess, sendError } from "../lib/response"
import { JWT_REFRESH_EXPIRY_SECONDS } from "../lib/auth-config"

const registerSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().trim().min(8),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  country: z.string().trim().min(1).optional(),
})

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().trim().min(1),
  deviceFingerprint: z.string().min(1),
  deviceType: z.enum(["PC", "MOBILE"]),
  forceLogout: z.boolean().optional(),
})

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  country: z.string().min(1).optional(),
})

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body)
    const user = await registerUser(data)
    return sendSuccess(res, user, 201)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "EMAIL_EXISTS") {
      return sendError(res, "EMAIL_EXISTS", error.message, 409)
    }
    next(err)
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginSchema.parse(req.body)
    const ip = req.ip || req.socket.remoteAddress || "unknown"

    const result = await loginUser(
      data.email,
      data.password,
      data.deviceType,
      data.deviceFingerprint,
      ip,
      req.headers["user-agent"],
      data.forceLogout
    )

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: JWT_REFRESH_EXPIRY_SECONDS * 1000,
      path: "/",
    }

    res.cookie("refreshToken", result.refreshToken, cookieOptions)
    res.cookie("userRole", result.user.role, {
      ...cookieOptions,
      httpOnly: false,
    })

    return sendSuccess(res, {
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
    })
  } catch (err) {
    const error = err as Error & { code?: string; deviceType?: string }
    if (error.code === "INVALID_CREDENTIALS") {
      return sendError(res, "INVALID_CREDENTIALS", error.message, 401)
    }
    if (error.code === "DEVICE_LIMIT_REACHED") {
      return sendError(res, "DEVICE_LIMIT_REACHED", error.message, 409)
    }
    next(err)
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.refreshToken
    if (!token) {
      return sendError(res, "NO_REFRESH_TOKEN", "Refresh token missing", 401)
    }
    const tokens = await refreshAccessToken(token)
    return sendSuccess(res, tokens)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "INVALID_REFRESH" || error.code === "SESSION_INVALID") {
      return sendError(res, error.code, error.message, 401)
    }
    next(err)
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user) {
      await logoutUser(req.user.userId, req.user.sessionId)
    }
    res.clearCookie("refreshToken", { path: "/" })
    res.clearCookie("userRole", { path: "/" })
    return sendSuccess(res, { message: "Logged out" })
  } catch (err) {
    next(err)
  }
}

/** Clears auth cookies without requiring a valid access token (stale session cleanup). */
export async function clearSession(_req: Request, res: Response) {
  res.clearCookie("refreshToken", { path: "/" })
  res.clearCookie("userRole", { path: "/" })
  return sendSuccess(res, { message: "Session cleared" })
}

export async function forceLogout(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({ deviceType: z.enum(["PC", "MOBILE"]) })
    const { deviceType } = schema.parse(req.body)

    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }

    await forceLogoutDevice(req.user.userId, deviceType)
    return sendSuccess(res, { message: `${deviceType} sessions cleared` })
  } catch (err) {
    next(err)
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }
    const user = await getUserById(req.user.userId)
    if (!user) {
      return sendError(res, "NOT_FOUND", "User not found", 404)
    }
    return sendSuccess(res, user)
  } catch (err) {
    next(err)
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()) })
    const { email } = schema.parse(req.body)
    await requestPasswordReset(email)
    return sendSuccess(res, {
      message: "If that email exists, a reset link has been sent.",
    })
  } catch (err) {
    next(err)
  }
}

export async function resetPasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      token: z.string().min(1),
      password: z.string().min(8),
    })
    const { token, password } = schema.parse(req.body)
    await resetPassword(token, password)
    return sendSuccess(res, { message: "Password reset successful" })
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "INVALID_TOKEN") {
      return sendError(res, "INVALID_TOKEN", error.message, 400)
    }
    next(err)
  }
}

export async function verifyEmailHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.query.token as string
    if (!token) {
      return sendError(res, "INVALID_TOKEN", "Verification token required", 400)
    }
    await verifyEmail(token)
    return sendSuccess(res, { verified: true })
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "INVALID_TOKEN") {
      return sendError(res, "INVALID_TOKEN", error.message, 400)
    }
    next(err)
  }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }
    const user = await getUserById(req.user.userId)
    if (!user) {
      return sendError(res, "NOT_FOUND", "User not found", 404)
    }
    if (user.isVerified) {
      return sendSuccess(res, { message: "Already verified" })
    }
    if (user.student) {
      await sendEmailVerification(user.id, user.email, user.student.firstName)
    }
    return sendSuccess(res, { message: "Verification email sent" })
  } catch (err) {
    next(err)
  }
}

export async function uploadAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }

    const file = req.file
    if (!file) {
      return sendError(res, "NO_FILE", "No image uploaded", 400)
    }

    const user = await updateStudentAvatar(
      req.user.userId,
      file.buffer,
      file.mimetype,
      file.originalname
    )
    return sendSuccess(res, user)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    if (error.code === "INVALID_FILE_TYPE" || error.code === "FILE_TOO_LARGE") {
      return sendError(res, error.code, error.message, 400)
    }
    next(err)
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }

    const data = updateProfileSchema.parse(req.body)
    const user = await updateStudentProfile(req.user.userId, data)
    return sendSuccess(res, user)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

