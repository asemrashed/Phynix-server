import { describe, expect, test } from "bun:test"
import { resolveChargedAmount } from "../src/lib/payment-amount"

describe("resolveChargedAmount", () => {
  test("keeps BDT amount for BDT gateway", () => {
    const result = resolveChargedAmount(1500, "BDT", "sslcommerz")
    expect(result).toEqual({ amount: 1500, currency: "BDT" })
  })

  test("rejects non-BDT base currency", () => {
    expect(() => resolveChargedAmount(35, "USD", "sslcommerz")).toThrow(
      "Only BDT pricing is supported"
    )
  })
})
