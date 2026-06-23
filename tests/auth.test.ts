import { describe, expect, test } from "bun:test"
import { createApp } from "../src/app"
import bcrypt from "bcrypt"
import { prisma } from "../src/lib/prisma"
import { loginUser } from "../src/services/auth.service"

const hasDatabase = !!process.env.DATABASE_URL

describe.skipIf(!hasDatabase)("Auth API", () => {
  test("register and login flow", async () => {
    const app = createApp()
    const server = app.listen(0)
    const port = (server.address() as { port: number }).port
    const base = `http://127.0.0.1:${port}/api/v1`
    const email = `test-${Date.now()}@fxprime.test`

    try {
      const registerRes = await fetch(`${base}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: "password123",
          firstName: "Test",
          lastName: "User",
          registrationType: "STUDENT",
        }),
      })
      expect(registerRes.status).toBe(201)
      const registerJson = await registerRes.json()
      expect(registerJson.success).toBe(true)
      expect(registerJson.data.email).toBe(email)
      expect(registerJson.data.student?.uniqueStudentId).toBeNull()

      const loginRes = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: "password123",
          deviceFingerprint: "test-device-fingerprint",
          deviceType: "PC",
        }),
      })
      expect(loginRes.status).toBe(200)
      const loginJson = await loginRes.json()
      expect(loginJson.success).toBe(true)
      expect(loginJson.data.accessToken).toBeDefined()
      expect(loginJson.data.user.student?.uniqueStudentId).toBeNull()
    } finally {
      server.close()
    }
  })

  test("rejects invalid login", async () => {
    const app = createApp()
    const server = app.listen(0)
    const port = (server.address() as { port: number }).port

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nobody@fxprime.test",
          password: "wrongpassword",
          deviceFingerprint: "test-device-fingerprint",
          deviceType: "PC",
        }),
      })
      expect(res.status).toBe(401)
    } finally {
      server.close()
    }
  })

  test("login with forceLogout clears device limit", async () => {
    const previousSkip = process.env.SKIP_DEVICE_LIMIT
    process.env.SKIP_DEVICE_LIMIT = "false"

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const email = `force-logout-${suffix}@fxprime.test`
    const password = "password123"
    const fingerprint = `force-logout-device-${suffix}`

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: "STUDENT",
        isVerified: true,
        student: {
          create: {
            firstName: "Force",
            lastName: "Logout",
            country: "Bangladesh",
            registrationType: "STUDENT",
            uniqueStudentId: `FXP-T-${suffix}`,
          },
        },
      },
      include: { student: true },
    })

    try {
      await loginUser(email, password, "PC", fingerprint, "127.0.0.1")

      const activeBefore = await prisma.deviceSession.count({
        where: { userId: user.id, isActive: true },
      })
      expect(activeBefore).toBe(1)

      await expect(
        loginUser(email, password, "PC", `${fingerprint}-other`, "127.0.0.1")
      ).rejects.toMatchObject({ code: "DEVICE_LIMIT_REACHED" })

      const result = await loginUser(
        email,
        password,
        "PC",
        `${fingerprint}-other`,
        "127.0.0.1",
        undefined,
        true
      )
      expect(result.tokens.accessToken).toBeDefined()

      const activeAfter = await prisma.deviceSession.count({
        where: { userId: user.id, isActive: true },
      })
      expect(activeAfter).toBe(1)
    } finally {
      if (previousSkip === undefined) {
        delete process.env.SKIP_DEVICE_LIMIT
      } else {
        process.env.SKIP_DEVICE_LIMIT = previousSkip
      }
      await prisma.deviceSession.deleteMany({ where: { userId: user.id } })
      await prisma.student.delete({ where: { id: user.student!.id } })
      await prisma.user.delete({ where: { id: user.id } })
    }
  })
})
