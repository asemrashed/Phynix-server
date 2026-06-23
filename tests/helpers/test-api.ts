import bcrypt from "bcrypt"
import { createApp } from "../../src/app"
import { prisma } from "../../src/lib/prisma"

export const hasDatabase = !!process.env.DATABASE_URL

export async function withTestServer(
  fn: (base: string) => Promise<void>
): Promise<void> {
  const app = createApp()
  const server = app.listen(0)
  const port = (server.address() as { port: number }).port
  const base = `http://127.0.0.1:${port}/api/v1`

  try {
    await fn(base)
  } finally {
    server.close()
  }
}

export async function registerTestStudent(base: string, password = "password123") {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const email = `test-${suffix}@fxprime.test`
  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "STUDENT",
      isVerified: true,
      student: {
        create: {
          firstName: "Test",
          lastName: "Student",
          country: "Bangladesh",
          registrationType: "STUDENT",
          uniqueStudentId: `FXP-T-${suffix.slice(-12)}`,
        },
      },
    },
    include: { student: true },
  })

  const loginRes = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      deviceFingerprint: `test-device-${suffix}`,
      deviceType: "PC",
    }),
  })

  if (loginRes.status !== 200) {
    await cleanupTestStudent(user.id, user.student!.id)
    throw new Error(`Login failed: ${loginRes.status}`)
  }

  const loginJson = await loginRes.json()

  return {
    email,
    password,
    userId: user.id,
    studentId: user.student!.id,
    accessToken: loginJson.data.accessToken as string,
  }
}

export function authHeaders(accessToken: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }
}

export async function createPremiumBlogFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const author = await prisma.user.create({
    data: {
      email: `author-${suffix}@fxprime.test`,
      passwordHash: "test",
      role: "ADMIN",
      isVerified: true,
    },
  })

  const category = await prisma.blogCategory.create({
    data: {
      name: `Test Category ${suffix}`,
      slug: `test-category-${suffix}`,
    },
  })

  const post = await prisma.blogPost.create({
    data: {
      title: `Premium Post ${suffix}`,
      slug: `premium-post-${suffix}`,
      excerpt: "Premium excerpt",
      content: "Full premium article body for integration tests.",
      categoryId: category.id,
      authorId: author.id,
      status: "PUBLISHED",
      isPremium: true,
      publishedAt: new Date(),
    },
  })

  async function cleanup() {
    await prisma.blogPost.delete({ where: { id: post.id } }).catch(() => {})
    await prisma.blogCategory.delete({ where: { id: category.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: author.id } }).catch(() => {})
  }

  return { post, cleanup }
}

export async function setStudentSubscription(
  studentId: string,
  data: {
    plan: "FREE" | "BASIC" | "PRO" | "LIFETIME"
    status: "ACTIVE" | "EXPIRED" | "GRACE" | "CANCELLED"
    expiresAt?: Date | null
  }
) {
  const { invalidatePremiumAccessCache } = await import("../../src/lib/premium-cache")
  const sub = await prisma.subscription.upsert({
    where: { studentId },
    create: {
      studentId,
      plan: data.plan,
      status: data.status,
      expiresAt: data.expiresAt ?? null,
    },
    update: {
      plan: data.plan,
      status: data.status,
      expiresAt: data.expiresAt ?? null,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    },
  })
  await invalidatePremiumAccessCache(studentId)
  return sub
}

export async function cleanupTestStudent(userId: string, studentId: string) {
  await prisma.subscription.deleteMany({ where: { studentId } }).catch(() => {})
  await prisma.paymentRecord.deleteMany({ where: { studentId } }).catch(() => {})
  await prisma.sessionRegistration.deleteMany({ where: { studentId } }).catch(() => {})
  await prisma.enrollment.deleteMany({ where: { studentId } }).catch(() => {})
  await prisma.student.delete({ where: { id: studentId } }).catch(() => {})
  await prisma.user.delete({ where: { id: userId } }).catch(() => {})
}
