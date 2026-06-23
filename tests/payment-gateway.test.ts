import { describe, expect, test, beforeEach } from "bun:test"
import { prisma } from "../src/lib/prisma"
import {
  getPublicPaymentConfig,
  resolveCheckoutGateway,
  updateAdminPaymentSettings,
} from "../src/services/payment-gateway.service"
import { hasDatabase } from "./helpers/test-api"

describe.skipIf(!hasDatabase)("payment gateway settings", () => {
  beforeEach(async () => {
    await prisma.paymentSettings.deleteMany()
    await prisma.paymentSettings.create({
      data: {
        id: "default",
        enabledGateways: ["sslcommerz"],
        defaultGateway: "sslcommerz",
        allowUserChoice: false,
      },
    })
  })

  test("public config exposes SSLCommerz only", async () => {
    const config = await getPublicPaymentConfig()
    expect(config.gateways).toHaveLength(1)
    expect(config.gateways[0]?.id).toBe("sslcommerz")
    expect(config.defaultGateway).toBe("sslcommerz")
    expect(config.allowUserChoice).toBe(false)
  })

  test("resolveCheckoutGateway always uses sslcommerz", async () => {
    const gateway = await resolveCheckoutGateway()
    expect(gateway).toBe("sslcommerz")
  })

  test("updateAdminPaymentSettings keeps sslcommerz as sole gateway", async () => {
    const settings = await updateAdminPaymentSettings({
      enabledGateways: ["sslcommerz"],
      defaultGateway: "sslcommerz",
      allowUserChoice: false,
    })

    expect(settings.gateways).toHaveLength(1)
    expect(settings.gateways[0]?.id).toBe("sslcommerz")

    const stored = await prisma.paymentSettings.findUnique({ where: { id: "default" } })
    expect(stored?.enabledGateways).toEqual(["sslcommerz"])
  })
})
