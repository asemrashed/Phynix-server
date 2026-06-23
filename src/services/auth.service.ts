import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { v4 as uuidv4 } from "uuid"
import type { AuthUser, AuthTokens, DeviceType, RegisterRequest } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { storeToken, getTokenValue, deleteToken } from "../lib/token-store"
import { sendPasswordResetEmail, sendWelcomeEmail, sendVerificationEmail } from "./email.service"
import fs from "fs"
import path from "path"
import { DEFAULT_REGISTRATION_TYPE, ensureUniqueStudentId } from "./student-id.service"
import { saveImageUpload } from "./upload.service"
import {
  JWT_ACCESS_EXPIRY,
  JWT_ACCESS_EXPIRY_SECONDS,
  JWT_REFRESH_EXPIRY_DAYS,
} from "../lib/auth-config"

const SALT_ROUNDS = 12

function isDeviceLimitSkipped(): boolean {
  return process.env.SKIP_DEVICE_LIMIT === "true"
}

async function assertDeviceSessionAvailable(userId: string, deviceType: DeviceType) {
  if (isDeviceLimitSkipped()) return

  const activeSessions = await prisma.deviceSession.count({
    where: { userId, deviceType, isActive: true },
  })

  if (activeSessions >= 1) {
    throw Object.assign(
      new Error(`${deviceType} session limit reached`),
      { code: "DEVICE_LIMIT_REACHED", deviceType }
    )
  }
}

export async function registerUser(data: RegisterRequest) {
  const existing = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  })
  if (existing) {
    throw Object.assign(new Error("Email already registered"), { code: "EMAIL_EXISTS" })
  }

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS)
  const country = data.country?.trim() || "Bangladesh"

  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      passwordHash,
      role: "STUDENT",
      student: {
        create: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          country,
          registrationType: DEFAULT_REGISTRATION_TYPE,
        },
      },
    },
    include: { student: true },
  })

  await sendWelcomeEmail(user.email, data.firstName)
  await sendEmailVerification(user.id, user.email, data.firstName)
  return formatAuthUser(user)
}

export async function sendEmailVerification(userId: string, email: string, firstName: string) {
  const token = await storeToken("verify", userId, 86400)
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  const verifyUrl = `${frontendUrl}/verify-email?token=${token}`
  await sendVerificationEmail(email, firstName, verifyUrl)
}

export async function verifyEmail(token: string): Promise<void> {
  const userId = await getTokenValue("verify", token)
  if (!userId) {
    throw Object.assign(new Error("Invalid or expired verification link"), {
      code: "INVALID_TOKEN",
    })
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isVerified: true },
  })
  await deleteToken("verify", token)
}

export async function loginUser(
  email: string,
  password: string,
  deviceType: DeviceType,
  deviceFingerprint: string,
  ipAddress: string,
  userAgent?: string,
  forceLogout = false
): Promise<{ user: AuthUser; tokens: AuthTokens; refreshToken: string; sessionId: string }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { student: true },
  })

  if (!user || !user.isActive) {
    throw Object.assign(new Error("Invalid credentials"), { code: "INVALID_CREDENTIALS" })
  }

  if (!user.passwordHash) {
    throw Object.assign(new Error("Invalid credentials"), { code: "INVALID_CREDENTIALS" })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    throw Object.assign(new Error("Invalid credentials"), { code: "INVALID_CREDENTIALS" })
  }

  if (forceLogout) {
    await forceLogoutAllDevices(user.id)
  } else {
    await assertDeviceSessionAvailable(user.id, deviceType)
  }

  const sessionId = uuidv4()
  await prisma.deviceSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      studentId: user.student?.id,
      deviceType,
      deviceFingerprint,
      ipAddress,
      userAgent,
    },
  })

  const { accessToken, refreshToken, expiresIn } = generateTokens(user.id, user.role, sessionId)

  return {
    user: formatAuthUser(user),
    tokens: { accessToken, expiresIn },
    refreshToken,
    sessionId,
  }
}

export async function refreshAccessToken(refreshToken: string) {
  let payload: { userId: string; role: string; sessionId: string }
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as typeof payload
  } catch {
    throw Object.assign(new Error("Invalid refresh token"), { code: "INVALID_REFRESH" })
  }

  const session = await prisma.deviceSession.findFirst({
    where: { id: payload.sessionId, isActive: true },
  })
  if (!session) {
    throw Object.assign(new Error("Session expired"), { code: "SESSION_INVALID" })
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true },
  })
  if (!user) {
    throw Object.assign(new Error("User not found"), { code: "SESSION_INVALID" })
  }

  const { accessToken, expiresIn } = generateTokens(
    payload.userId,
    user.role,
    payload.sessionId
  )

  return { accessToken, expiresIn }
}

export async function logoutUser(userId: string, sessionId?: string) {
  if (sessionId) {
    await prisma.deviceSession.updateMany({
      where: { id: sessionId, userId },
      data: { isActive: false },
    })
  }
}

export async function forceLogoutAllDevices(userId: string) {
  const activeSessions = await prisma.deviceSession.findMany({
    where: { userId, isActive: true },
    select: { id: true },
  })

  if (activeSessions.length === 0) return

  await prisma.deviceSession.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  })
}

export async function forceLogoutDevice(userId: string, deviceType: DeviceType) {
  const activeSessions = await prisma.deviceSession.findMany({
    where: { userId, deviceType, isActive: true },
    select: { id: true },
  })

  if (activeSessions.length === 0) return

  await prisma.deviceSession.updateMany({
    where: { userId, deviceType, isActive: true },
    data: { isActive: false },
  })
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { student: true },
  })
  if (!user) return null

  // Recovery backfill: enrolled students missing an ID (e.g. after partial fulfillment failure).
  if (user.student && !user.student.uniqueStudentId) {
    user.student.uniqueStudentId = await ensureUniqueStudentId(user.student.id)
  }

  return formatAuthUser(user)
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  })

  if (!user) return

  const token = await storeToken("reset", user.id, 3600)
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`
  await sendPasswordResetEmail(user.email, resetUrl)
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const userId = await getTokenValue("reset", token)
  if (!userId) {
    throw Object.assign(new Error("Invalid or expired reset token"), { code: "INVALID_TOKEN" })
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  })
  await deleteToken("reset", token)
}

export async function updateStudentProfile(
  userId: string,
  data: { firstName?: string; lastName?: string; phone?: string; country?: string }
): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { student: true },
  })

  if (!user?.student) {
    throw Object.assign(new Error("Student profile not found"), { code: "NOT_FOUND" })
  }

  const country = data.country ?? user.student.country
  const updated = await prisma.student.update({
    where: { id: user.student.id },
    data: {
      firstName: data.firstName ?? user.student.firstName,
      lastName: data.lastName ?? user.student.lastName,
      phone: data.phone !== undefined ? data.phone || null : user.student.phone,
      country,
    },
  })

  return formatAuthUser({ ...user, student: updated })
}

export async function updateStudentAvatar(
  userId: string,
  buffer: Buffer,
  mimetype: string,
  originalName: string
): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { student: true },
  })

  if (!user?.student) {
    throw Object.assign(new Error("Student profile not found"), { code: "NOT_FOUND" })
  }

  const avatarUrl = await saveImageUpload(buffer, mimetype, originalName, "avatars")

  if (user.student.avatarUrl) {
    const oldPath = path.join(process.cwd(), user.student.avatarUrl.replace(/^\//, ""))
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath)
    }
  }

  const updated = await prisma.student.update({
    where: { id: user.student.id },
    data: { avatarUrl },
  })

  return formatAuthUser({ ...user, student: updated })
}

function generateTokens(userId: string, role: string, sessionId: string) {
  const accessToken = jwt.sign(
    { userId, role, sessionId },
    process.env.JWT_SECRET!,
    { expiresIn: JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"] }
  )

  const refreshToken = jwt.sign(
    { userId, role, sessionId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: `${JWT_REFRESH_EXPIRY_DAYS}d` }
  )

  return { accessToken, refreshToken, expiresIn: JWT_ACCESS_EXPIRY_SECONDS }
}

function formatAuthUser(user: {
  id: string
  email: string
  role: string
  isVerified: boolean
  student: {
    id: string
    uniqueStudentId: string | null
    firstName: string
    lastName: string
    phone: string | null
    country: string
    avatarUrl: string | null
    registrationType: string
  } | null
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role as AuthUser["role"],
    isVerified: user.isVerified,
    student: user.student
      ? {
          id: user.student.id,
          uniqueStudentId: user.student.uniqueStudentId,
          firstName: user.student.firstName,
          lastName: user.student.lastName,
          phone: user.student.phone,
          country: user.student.country,
          avatarUrl: user.student.avatarUrl,
          registrationType: user.student.registrationType,
        }
      : null,
  }
}
