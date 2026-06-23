export const MENTOR_CANCEL_HOURS = Number(process.env.MENTOR_CANCEL_HOURS || 24)

export function hoursUntilSession(scheduledAt: Date, now = new Date()): number {
  return (scheduledAt.getTime() - now.getTime()) / (60 * 60 * 1000)
}

export function canModifyBooking(
  scheduledAt: Date,
  status: string,
  now = new Date()
): boolean {
  if (!["CONFIRMED", "PENDING"].includes(status)) return false
  return hoursUntilSession(scheduledAt, now) >= MENTOR_CANCEL_HOURS
}

export type MentorReminderFlags = {
  twentyFourHour?: string
  oneHour?: string
}

export function getMentorReminderFlags(raw: unknown): MentorReminderFlags {
  if (!raw || typeof raw !== "object") return {}
  return raw as MentorReminderFlags
}
