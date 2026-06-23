import { describe, expect, test } from "bun:test"
import { createApp } from "../src/app"

describe("GET /", () => {
  test("returns server is working", async () => {
    const app = createApp()
    const server = app.listen(0)
    const port = (server.address() as { port: number }).port

    try {
      const res = await fetch(`http://127.0.0.1:${port}/`)
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/plain")
      expect(await res.text()).toBe("server is working")
    } finally {
      server.close()
    }
  })
})

describe("GET /api/v1/health", () => {
  test("returns ok status", async () => {
    const app = createApp()
    const server = app.listen(0)
    const port = (server.address() as { port: number }).port

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.status).toBe("ok")
    } finally {
      server.close()
    }
  })
})
