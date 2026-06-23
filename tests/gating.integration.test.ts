import { describe, expect, test } from "bun:test"
import { prisma } from "../src/lib/prisma"
import { getPremiumAccessInfo } from "../src/services/access-control.service"
import { isPaidPlanEffective } from "../src/lib/subscription-utils"
import {
  authHeaders,
  cleanupTestStudent,
  createPremiumBlogFixture,
  hasDatabase,
  registerTestStudent,
  setStudentSubscription,
  withTestServer,
} from "./helpers/test-api"

describe("subscription-utils", () => {
  test("isPaidPlanEffective handles active PRO, grace, and expired plans", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const recentlyExpired = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const longExpired = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    expect(
      isPaidPlanEffective({ plan: "PRO", status: "ACTIVE", expiresAt: future })
    ).toBe(true)

    expect(
      isPaidPlanEffective({ plan: "PRO", status: "GRACE", expiresAt: recentlyExpired })
    ).toBe(true)

    expect(
      isPaidPlanEffective({ plan: "PRO", status: "EXPIRED", expiresAt: longExpired })
    ).toBe(false)

    expect(
      isPaidPlanEffective({ plan: "LIFETIME", status: "ACTIVE", expiresAt: null })
    ).toBe(true)

    expect(
      isPaidPlanEffective({ plan: "FREE", status: "ACTIVE", expiresAt: null })
    ).toBe(false)
  })
})

describe.skipIf(!hasDatabase)("Premium access (database)", () => {
  test("getPremiumAccessInfo reflects PRO subscription state", async () => {
    const student = await registerTestStudentForServiceTest()
    try {
      await setStudentSubscription(student.studentId, {
        plan: "PRO",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })

      const active = await getPremiumAccessInfo(student.studentId)
      expect(active.hasPremiumAccess).toBe(true)
      expect(active.plan).toBe("PRO")

      await setStudentSubscription(student.studentId, {
        plan: "PRO",
        status: "EXPIRED",
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })

      const expired = await getPremiumAccessInfo(student.studentId)
      expect(expired.hasPremiumAccess).toBe(false)
    } finally {
      await cleanupTestStudent(student.userId, student.studentId)
    }
  })
})

async function registerTestStudentForServiceTest() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const user = await prisma.user.create({
    data: {
      email: `svc-${suffix}@fxprime.test`,
      passwordHash: "test",
      role: "STUDENT",
      isVerified: true,
      student: {
        create: {
          firstName: "Svc",
          lastName: "Test",
          country: "Bangladesh",
          registrationType: "STUDENT",
        },
      },
    },
    include: { student: true },
  })

  return {
    userId: user.id,
    studentId: user.student!.id,
  }
}

describe.skipIf(!hasDatabase)("Premium blog gating (API)", () => {
  test("gates premium content for anonymous and FREE users; unlocks for PRO", async () => {
    const fixture = await createPremiumBlogFixture()

    await withTestServer(async (base) => {
      const student = await registerTestStudent(base)

      try {
        const anonRes = await fetch(`${base}/blog/${fixture.post.slug}`)
        expect(anonRes.status).toBe(200)
        const anonJson = await anonRes.json()
        expect(anonJson.data.isGated).toBe(true)
        expect(anonJson.data.content).toBeNull()

        const freeRes = await fetch(`${base}/blog/${fixture.post.slug}`, {
          headers: authHeaders(student.accessToken),
        })
        expect(freeRes.status).toBe(200)
        const freeJson = await freeRes.json()
        expect(freeJson.data.isGated).toBe(true)
        expect(freeJson.data.content).toBeNull()

        await setStudentSubscription(student.studentId, {
          plan: "PRO",
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })

        const proRes = await fetch(`${base}/blog/${fixture.post.slug}`, {
          headers: authHeaders(student.accessToken),
        })
        expect(proRes.status).toBe(200)
        const proJson = await proRes.json()
        expect(proJson.data.isGated).toBe(false)
        expect(proJson.data.content).toBe(fixture.post.content)
      } finally {
        await cleanupTestStudent(student.userId, student.studentId)
      }
    })

    await fixture.cleanup()
  })

  test("returns full content for non-premium posts without subscription", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const author = await prisma.user.create({
      data: {
        email: `author-free-${suffix}@fxprime.test`,
        passwordHash: "test",
        role: "ADMIN",
        isVerified: true,
      },
    })
    const category = await prisma.blogCategory.create({
      data: { name: `Free Cat ${suffix}`, slug: `free-cat-${suffix}` },
    })
    const post = await prisma.blogPost.create({
      data: {
        title: `Free Post ${suffix}`,
        slug: `free-post-${suffix}`,
        excerpt: "Free excerpt",
        content: "Free public content.",
        categoryId: category.id,
        authorId: author.id,
        status: "PUBLISHED",
        isPremium: false,
        publishedAt: new Date(),
      },
    })

    await withTestServer(async (base) => {
      const res = await fetch(`${base}/blog/${post.slug}`)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data.isGated).toBe(false)
      expect(json.data.content).toBe(post.content)
    })

    await prisma.blogPost.delete({ where: { id: post.id } })
    await prisma.blogCategory.delete({ where: { id: category.id } })
    await prisma.user.delete({ where: { id: author.id } })
  })
})

describe.skipIf(!hasDatabase)("Subscription API", () => {
  test("GET /subscription/me reports premium access for active PRO plan", async () => {
    await withTestServer(async (base) => {
      const student = await registerTestStudent(base)

      try {
        const freeRes = await fetch(`${base}/subscription/me`, {
          headers: authHeaders(student.accessToken),
        })
        expect(freeRes.status).toBe(200)
        const freeJson = await freeRes.json()
        expect(freeJson.data.hasPremiumAccess).toBe(false)

        await setStudentSubscription(student.studentId, {
          plan: "PRO",
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })

        const proRes = await fetch(`${base}/subscription/me`, {
          headers: authHeaders(student.accessToken),
        })
        expect(proRes.status).toBe(200)
        const proJson = await proRes.json()
        expect(proJson.data.hasPremiumAccess).toBe(true)
        expect(proJson.data.plan).toBe("PRO")
      } finally {
        await cleanupTestStudent(student.userId, student.studentId)
      }
    })
  })
})
