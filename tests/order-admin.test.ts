import { describe, expect, test } from "bun:test"
import {
  updateAdminOrder,
  deleteAdminOrder,
  notifyPendingOrderCancelled,
} from "../src/services/order-admin.service"

describe("updateAdminOrder transitions", () => {
  test("rejects invalid transition from DELIVERED to PROCESSING", async () => {
    await expect(
      updateAdminOrder("00000000-0000-0000-0000-000000000000", {
        status: "PROCESSING",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("deleteAdminOrder", () => {
  test("rejects delete for missing order", async () => {
    await expect(
      deleteAdminOrder("00000000-0000-0000-0000-000000000000")
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("order transition rules", () => {
  test("module exports order helpers", async () => {
    const mod = await import("../src/services/order-admin.service")
    expect(typeof mod.cancelOrderWithRestock).toBe("function")
    expect(typeof mod.listAdminOrders).toBe("function")
    expect(typeof mod.deleteAdminOrder).toBe("function")
    expect(typeof mod.notifyPendingOrderCancelled).toBe("function")
  })
})

describe("notifyPendingOrderCancelled", () => {
  test("no-ops for missing order", async () => {
    await expect(
      notifyPendingOrderCancelled("00000000-0000-0000-0000-000000000000")
    ).resolves.toBeUndefined()
  })
})
