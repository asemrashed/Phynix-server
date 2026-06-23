import type { PaymentGateway } from "@fxprime/types"
import { getGatewayCurrency } from "../services/payment-gateway.service"

/** Resolve the amount + currency charged for a gateway (BDT only). */
export function resolveChargedAmount(
  baseAmount: number,
  baseCurrency: string,
  gateway: PaymentGateway
): { amount: number; currency: "BDT" } {
  const targetCurrency = getGatewayCurrency(gateway)
  const normalizedBase = baseCurrency.toUpperCase()

  if (normalizedBase !== "BDT") {
    throw Object.assign(new Error("Only BDT pricing is supported"), {
      code: "UNSUPPORTED_CURRENCY",
    })
  }

  return { amount: baseAmount, currency: targetCurrency }
}
