export const INSTALLMENT_ACCESS_GRACE_DAYS = Number(
  process.env.INSTALLMENT_ACCESS_GRACE_DAYS || 3
)

export const INSTALLMENT_REMINDER_DAYS_BEFORE = 3

export type InstallmentReminderFlags = {
  threeDay?: string
  dueDay?: string
  overdue?: string
}

export function getInstallmentReminderFlags(
  raw: unknown
): InstallmentReminderFlags {
  if (!raw || typeof raw !== "object") return {}
  const flags = raw as Record<string, unknown>
  return {
    threeDay: typeof flags.threeDay === "string" ? flags.threeDay : undefined,
    dueDay: typeof flags.dueDay === "string" ? flags.dueDay : undefined,
    overdue: typeof flags.overdue === "string" ? flags.overdue : undefined,
  }
}
