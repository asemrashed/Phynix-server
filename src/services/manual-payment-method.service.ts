import type { ManualPaymentMethodConfig, ManualPaymentProvider } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { MANUAL_PAYMENT_PROVIDERS } from "../lib/manual-payment"

const METHOD_LABELS: Record<ManualPaymentProvider, string> = {
  bkash: "bKash",
  nagad: "Nagad",
}

export async function ensureManualPaymentMethods() {
  for (const id of MANUAL_PAYMENT_PROVIDERS) {
    await prisma.manualPaymentMethod.upsert({
      where: { id },
      create: { id, enabled: false, merchantNumber: "" },
      update: {},
    })
  }
}

export async function listManualPaymentMethods(): Promise<ManualPaymentMethodConfig[]> {
  await ensureManualPaymentMethods()
  const rows = await prisma.manualPaymentMethod.findMany({
    where: { id: { in: [...MANUAL_PAYMENT_PROVIDERS] } },
    orderBy: { id: "asc" },
  })

  return rows.map((row) => ({
    id: row.id as ManualPaymentProvider,
    label: METHOD_LABELS[row.id as ManualPaymentProvider],
    enabled: row.enabled,
    merchantNumber: row.merchantNumber,
    merchantName: row.merchantName,
    qrImageUrl: row.qrImageUrl,
    instructions: row.instructions,
  }))
}

export async function getManualPaymentMethod(
  provider: ManualPaymentProvider
): Promise<ManualPaymentMethodConfig | null> {
  await ensureManualPaymentMethods()
  const row = await prisma.manualPaymentMethod.findUnique({ where: { id: provider } })
  if (!row) return null
  return {
    id: provider,
    label: METHOD_LABELS[provider],
    enabled: row.enabled,
    merchantNumber: row.merchantNumber,
    merchantName: row.merchantName,
    qrImageUrl: row.qrImageUrl,
    instructions: row.instructions,
  }
}

export function isManualMethodConfigured(method: ManualPaymentMethodConfig): boolean {
  return method.enabled && method.merchantNumber.trim().length >= 11
}

export async function updateManualPaymentMethod(
  provider: ManualPaymentProvider,
  input: {
    enabled: boolean
    merchantNumber: string
    merchantName?: string
    qrImageUrl?: string
    instructions?: string
  }
): Promise<ManualPaymentMethodConfig> {
  await ensureManualPaymentMethods()
  const row = await prisma.manualPaymentMethod.update({
    where: { id: provider },
    data: {
      enabled: input.enabled,
      merchantNumber: input.merchantNumber.trim(),
      merchantName: input.merchantName?.trim() || null,
      qrImageUrl: input.qrImageUrl?.trim() || null,
      instructions: input.instructions?.trim() || null,
    },
  })

  return {
    id: provider,
    label: METHOD_LABELS[provider],
    enabled: row.enabled,
    merchantNumber: row.merchantNumber,
    merchantName: row.merchantName,
    qrImageUrl: row.qrImageUrl,
    instructions: row.instructions,
  }
}
