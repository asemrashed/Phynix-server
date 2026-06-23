import { expireStaleManualPayments } from "../services/manual-payment.service"
import { markOverdueInstallments } from "../services/installment.service"
import {
  processInstallmentReminders,
  suspendOverdueInstallmentAccess,
} from "../services/installment-lifecycle.service"

export async function runPaymentLifecycleTasks() {
  const expiredManual = await expireStaleManualPayments()
  const overdueInstallments = await markOverdueInstallments()
  const suspendedAccess = await suspendOverdueInstallmentAccess()
  const remindersSent = await processInstallmentReminders()

  if (
    expiredManual > 0 ||
    overdueInstallments > 0 ||
    suspendedAccess > 0 ||
    remindersSent > 0
  ) {
    console.log(
      `[Payment Lifecycle] Expired ${expiredManual} manual payments, marked ${overdueInstallments} installments overdue, suspended ${suspendedAccess} agreements, sent ${remindersSent} reminders`
    )
  }

  return { expiredManual, overdueInstallments, suspendedAccess, remindersSent }
}

export function startPaymentLifecycleScheduler() {
  const intervalMs = Number(process.env.PAYMENT_LIFECYCLE_INTERVAL_MS || 60 * 60 * 1000)

  setInterval(() => {
    runPaymentLifecycleTasks().catch((err) => {
      console.error("[Payment Lifecycle] Failed:", err)
    })
  }, intervalMs)

  runPaymentLifecycleTasks().catch(console.error)
  console.log(`[Payment Lifecycle] Scheduler started (every ${intervalMs / 60000}min)`)
}
