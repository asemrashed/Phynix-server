import { describe, expect, test } from "bun:test"
import { createApp } from "../src/app"

const hasDatabase = !!process.env.DATABASE_URL

describe.skipIf(!hasDatabase)("GET /api/v1/certificates/:certCode/verify", () => {
  test("returns 404 for unknown code", async () => {
    const app = createApp()
    const server = app.listen(0)
    const port = (server.address() as { port: number }).port

    try {
      const res = await fetch(
        `http://127.0.0.1:${port}/api/v1/certificates/FXP-INVALID/verify`
      )
      expect(res.status).toBe(404)
    } finally {
      server.close()
    }
  })
})

describe.skipIf(!hasDatabase)("Certificate download security", () => {
  test("requires authentication", async () => {
    const app = createApp()
    const server = app.listen(0)
    const port = (server.address() as { port: number }).port

    try {
      const res = await fetch(
        `http://127.0.0.1:${port}/api/v1/certificates/FXP-TEST/download`
      )
      expect(res.status).toBe(401)
    } finally {
      server.close()
    }
  })
})
