import type { ManualPaymentProvider, PaymentGateway } from "@fxprime/types"

export const MANUAL_PAYMENT_PROVIDERS: ManualPaymentProvider[] = ["bkash", "nagad"]

export function isManualPaymentGateway(gateway: string): gateway is ManualPaymentProvider {
  return gateway === "bkash" || gateway === "nagad"
}

export function isManualPaymentGatewayOption(gateway: PaymentGateway): boolean {
  return isManualPaymentGateway(gateway)
}

export function generateReferenceCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
  let code = "FXP-"
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]!
  }
  return code
}

export function normalizeBdPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("880")) return `0${digits.slice(3)}`
  if (digits.startsWith("01") && digits.length === 11) return digits
  throw Object.assign(new Error("Invalid Bangladesh mobile number"), { code: "INVALID_PHONE" })
}

export function normalizeTrxId(trxId: string): string {
  return trxId.trim().toUpperCase()
}
