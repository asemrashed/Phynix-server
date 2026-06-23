import { describe, expect, test } from "bun:test"
import {
  getCertificateVerifyUrl,
  getPublicSiteUrl,
  isAllowedPublicOrigin,
} from "../src/lib/site-url"

describe("site-url", () => {
  test("getCertificateVerifyUrl encodes cert code", () => {
    const url = getCertificateVerifyUrl("CERT-FXP-2026-00002", "https://fxprimeacademy.com")
    expect(url).toBe("https://fxprimeacademy.com/verify/CERT-FXP-2026-00002")
  })

  test("isAllowedPublicOrigin accepts localhost", () => {
    expect(isAllowedPublicOrigin("http://localhost:3000")).toBe(true)
    expect(isAllowedPublicOrigin("javascript:alert(1)")).toBe(false)
  })

  test("getPublicSiteUrl strips trailing slash", () => {
    const prev = process.env.PUBLIC_SITE_URL
    process.env.PUBLIC_SITE_URL = "https://example.com/"
    expect(getPublicSiteUrl()).toBe("https://example.com")
    if (prev === undefined) delete process.env.PUBLIC_SITE_URL
    else process.env.PUBLIC_SITE_URL = prev
  })
})
