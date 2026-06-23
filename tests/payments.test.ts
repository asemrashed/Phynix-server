import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { createApp } from "../src/app"
import { prisma } from "../src/lib/prisma"
import {
  authHeaders,
  cleanupTestStudent,
  hasDatabase,
  registerTestStudent,
  withTestServer,
} from "./helpers/test-api"

describe.skipIf(!hasDatabase)("SSLCommerz success redirect", () => {
  test("redirects to payment success without tran_id", async () => {
    const app = createApp()
    const server = app.listen(0)
    const port = (server.address() as { port: number }).port

    try {
      const res = await fetch(
        `http://127.0.0.1:${port}/api/v1/payments/sslcommerz/success`,
        { redirect: "manual" }
      )
      expect(res.status).toBe(302)
      const location = res.headers.get("location") || ""
      expect(location).toContain("/payment/success")
    } finally {
      server.close()
    }
  })

  test("unknown tran_id redirects to generic success page", async () => {
    const app = createApp()
    const server = app.listen(0)
    const port = (server.address() as { port: number }).port

    try {
      const res = await fetch(
        `http://127.0.0.1:${port}/api/v1/payments/sslcommerz/success?tran_id=unknown-txn&status=FAILED`,
        { redirect: "manual" }
      )
      expect(res.status).toBe(302)
      const location = res.headers.get("location") || ""
      expect(location).toMatch(/\/payment\/success$/)
    } finally {
      server.close()
    }
  })
})

describe("POST /payments/simulate/:paymentId", () => {
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
  })

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  test("returns 403 in production", async () => {
    process.env.NODE_ENV = "production"

    await withTestServer(async (base) => {
      const res = await fetch(`${base}/payments/simulate/some-payment-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.error.code).toBe("NOT_AVAILABLE")
    })
  })

  test("requires authentication in development", async () => {
    process.env.NODE_ENV = "development"

    await withTestServer(async (base) => {
      const res = await fetch(`${base}/payments/simulate/some-payment-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      expect(res.status).toBe(401)
    })
  })
})

describe.skipIf(!hasDatabase)("Payment simulate flow", () => {
  test("completes a pending payment for the owning student", async () => {
    process.env.NODE_ENV = "development"

    await withTestServer(async (base) => {
      const student = await registerTestStudent(base)

      const payment = await prisma.paymentRecord.create({
        data: {
          studentId: student.studentId,
          type: "COURSE",
          amount: 999,
          currency: "BDT",
          gateway: "sslcommerz",
          status: "PENDING",
          tranId: `TEST${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        },
      })

      try {
        const res = await fetch(`${base}/payments/simulate/${payment.id}`, {
          method: "POST",
          headers: authHeaders(student.accessToken),
        })
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.success).toBe(true)
        expect(json.data.status).toBe("COMPLETED")

        const updated = await prisma.paymentRecord.findUnique({
          where: { id: payment.id },
        })
        expect(updated?.status).toBe("COMPLETED")
        expect(updated?.paymentRef).toBeTruthy()
      } finally {
        await prisma.paymentRecord.delete({ where: { id: payment.id } }).catch(() => {})
        await cleanupTestStudent(student.userId, student.studentId)
      }
    })
  })

  test("rejects simulate for another student's payment", async () => {
    process.env.NODE_ENV = "development"

    await withTestServer(async (base) => {
      const owner = await registerTestStudent(base)
      const other = await registerTestStudent(base)

      const payment = await prisma.paymentRecord.create({
        data: {
          studentId: owner.studentId,
          type: "COURSE",
          amount: 500,
          currency: "BDT",
          gateway: "sslcommerz",
          status: "PENDING",
          tranId: `TEST${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        },
      })

      try {
        const res = await fetch(`${base}/payments/simulate/${payment.id}`, {
          method: "POST",
          headers: authHeaders(other.accessToken),
        })
        expect(res.status).toBe(404)
        const json = await res.json()
        expect(json.error.code).toBe("NOT_FOUND")
      } finally {
        await prisma.paymentRecord.delete({ where: { id: payment.id } }).catch(() => {})
        await cleanupTestStudent(owner.userId, owner.studentId)
        await cleanupTestStudent(other.userId, other.studentId)
      }
    })
  }, 20000)
})
