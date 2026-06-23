import { describe, expect, test } from "bun:test"
import {
  canBypassPremiumGate,
  planHasPremiumAccess,
} from "../src/services/access-control.service"

describe("access-control.service", () => {
  test("planHasPremiumAccess grants PRO and LIFETIME only", () => {
    expect(planHasPremiumAccess("PRO")).toBe(true)
    expect(planHasPremiumAccess("LIFETIME")).toBe(true)
    expect(planHasPremiumAccess("FREE")).toBe(false)
    expect(planHasPremiumAccess("BASIC")).toBe(false)
  })

  test("canBypassPremiumGate allows admin roles", () => {
    expect(canBypassPremiumGate("ADMIN")).toBe(true)
    expect(canBypassPremiumGate("SUPER_ADMIN")).toBe(true)
    expect(canBypassPremiumGate("INSTRUCTOR")).toBe(true)
    expect(canBypassPremiumGate("STUDENT")).toBe(false)
    expect(canBypassPremiumGate(undefined)).toBe(false)
  })
})
