import type {
  AdminPaymentGatewaySetting,
  AdminPaymentSettings,
  PaymentConfigResponse,
  PaymentGateway,
  UpdatePaymentSettingsRequest,
} from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { isManualPaymentGateway } from "../lib/manual-payment"
import { PAYMENT_GATEWAY_IDS } from "../lib/payment-gateways"
import { isSSLCommerzConfigured } from "./sslcommerz.service"
import { listManualPaymentMethods } from "./manual-payment-method.service"

const SETTINGS_ID = "default"

export const PAYMENT_GATEWAYS: PaymentGateway[] = [...PAYMENT_GATEWAY_IDS]

const GATEWAY_META: Record<PaymentGateway, { label: string; currency: "BDT" }> = {
  sslcommerz: { label: "SSLCommerz", currency: "BDT" },
}

export function isGatewayConfigured(gateway: PaymentGateway): boolean {
  if (gateway === "sslcommerz") return isSSLCommerzConfigured()
  return false
}

export async function isGatewayConfiguredAsync(gateway: PaymentGateway): Promise<boolean> {
  return isGatewayConfigured(gateway)
}

export function getGatewayCurrency(gateway: PaymentGateway): "BDT" {
  return GATEWAY_META[gateway].currency
}

function parseGateway(value: string): PaymentGateway | null {
  return PAYMENT_GATEWAYS.includes(value as PaymentGateway) ? (value as PaymentGateway) : null
}

async function getSettingsRecord() {
  return prisma.paymentSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  })
}

function normalizeEnabledGateways(enabled: string[]): PaymentGateway[] {
  const seen = new Set<PaymentGateway>()
  const normalized: PaymentGateway[] = []

  for (const value of enabled) {
    const gateway = parseGateway(value)
    if (!gateway || seen.has(gateway)) continue
    seen.add(gateway)
    normalized.push(gateway)
  }

  return normalized.length > 0 ? normalized : ["sslcommerz"]
}

function resolveDefaultGateway(
  enabled: PaymentGateway[],
  requested: string
): PaymentGateway {
  const parsed = parseGateway(requested)
  if (parsed && enabled.includes(parsed)) return parsed
  return enabled[0] ?? "sslcommerz"
}

export async function getAvailableGateways(): Promise<PaymentGateway[]> {
  const settings = await getSettingsRecord()
  const enabled = normalizeEnabledGateways(settings.enabledGateways)
  const available: PaymentGateway[] = []
  for (const gateway of enabled) {
    if (await isGatewayConfiguredAsync(gateway)) available.push(gateway)
  }
  return available
}

export async function resolveCheckoutGateway(
  requested?: PaymentGateway
): Promise<PaymentGateway> {
  const settings = await getSettingsRecord()
  const enabled = normalizeEnabledGateways(settings.enabledGateways)
  const available = await getAvailableGateways()

  if (available.length === 0) {
    throw Object.assign(new Error("No payment gateway is available"), {
      code: "NO_PAYMENT_GATEWAY",
    })
  }

  if (requested && settings.allowUserChoice) {
    if (!enabled.includes(requested)) {
      throw Object.assign(new Error("Payment gateway is disabled"), {
        code: "GATEWAY_DISABLED",
      })
    }
    if (!(await isGatewayConfiguredAsync(requested))) {
      throw Object.assign(new Error("Payment gateway is not configured"), {
        code: "GATEWAY_NOT_CONFIGURED",
      })
    }
    return requested
  }

  return resolveDefaultGateway(available, settings.defaultGateway)
}

export async function getPublicPaymentConfig(): Promise<PaymentConfigResponse> {
  const settings = await getSettingsRecord()
  const enabled = normalizeEnabledGateways(settings.enabledGateways)
  const available = await getAvailableGateways()
  const defaultGateway = resolveDefaultGateway(
    available.length > 0 ? available : enabled,
    settings.defaultGateway
  )
  const manualMethods = await listManualPaymentMethods()

  const gateways = await Promise.all(
    PAYMENT_GATEWAYS.filter((id) => enabled.includes(id)).map(async (id) => ({
      id,
      label: GATEWAY_META[id].label,
      currency: GATEWAY_META[id].currency,
      configured: await isGatewayConfiguredAsync(id),
      available: enabled.includes(id) && (await isGatewayConfiguredAsync(id)),
      manual: isManualPaymentGateway(id),
    }))
  )

  return {
    gateways,
    defaultGateway,
    allowUserChoice: false,
    manualMethods,
  }
}

export async function getAdminPaymentSettings(): Promise<AdminPaymentSettings> {
  const settings = await getSettingsRecord()
  const enabled = normalizeEnabledGateways(settings.enabledGateways)
  const defaultGateway = resolveDefaultGateway(enabled, settings.defaultGateway)
  const manualMethods = await listManualPaymentMethods()

  const gateways: AdminPaymentGatewaySetting[] = await Promise.all(
    PAYMENT_GATEWAYS.map(async (id) => ({
      id,
      label: GATEWAY_META[id].label,
      currency: GATEWAY_META[id].currency,
      configured: await isGatewayConfiguredAsync(id),
      enabled: enabled.includes(id),
    }))
  )

  return {
    gateways,
    defaultGateway,
    allowUserChoice: settings.allowUserChoice,
    manualMethods,
  }
}

export async function updateAdminPaymentSettings(
  input: UpdatePaymentSettingsRequest
): Promise<AdminPaymentSettings> {
  const enabled = normalizeEnabledGateways(input.enabledGateways)
  const defaultGateway = resolveDefaultGateway(enabled, input.defaultGateway)

  await prisma.paymentSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      enabledGateways: enabled,
      defaultGateway,
      allowUserChoice: input.allowUserChoice,
    },
    update: {
      enabledGateways: enabled,
      defaultGateway,
      allowUserChoice: input.allowUserChoice,
    },
  })

  return getAdminPaymentSettings()
}

export async function isAnyPaymentGatewayAvailable(): Promise<boolean> {
  const available = await getAvailableGateways()
  return available.length > 0
}
