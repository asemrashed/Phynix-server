const DEFAULT_TIMEZONE = "Asia/Dhaka"
const JOIN_BUFFER_MINUTES = 15

export function getMeetingTimezone(): string {
  return process.env.MEETING_TIMEZONE || DEFAULT_TIMEZONE
}

export function getJoinWindow(
  scheduledAt: Date,
  durationMinutes: number,
  bufferMinutes = JOIN_BUFFER_MINUTES
) {
  const opensAt = new Date(scheduledAt.getTime() - bufferMinutes * 60 * 1000)
  const closesAt = new Date(
    scheduledAt.getTime() + (durationMinutes + bufferMinutes) * 60 * 1000
  )
  return { opensAt, closesAt }
}

export function canAccessMeeting(
  scheduledAt: Date,
  durationMinutes: number,
  now = new Date()
): boolean {
  const { opensAt, closesAt } = getJoinWindow(scheduledAt, durationMinutes)
  return now >= opensAt && now <= closesAt
}

export type SessionPhase = "upcoming" | "live" | "ended"

export function getSessionPhase(
  scheduledAt: Date,
  durationMinutes: number,
  now = new Date()
): SessionPhase {
  const { opensAt, closesAt } = getJoinWindow(scheduledAt, durationMinutes)
  if (now < opensAt) return "upcoming"
  if (now <= closesAt) return "live"
  return "ended"
}

export function gateJoinUrl(
  joinUrl: string | null | undefined,
  scheduledAt: Date,
  durationMinutes: number
): { joinUrl: string | null; canJoin: boolean; joinOpensAt: string } {
  const { opensAt } = getJoinWindow(scheduledAt, durationMinutes)
  const canJoin = canAccessMeeting(scheduledAt, durationMinutes)
  return {
    joinUrl: canJoin ? joinUrl ?? null : null,
    canJoin,
    joinOpensAt: opensAt.toISOString(),
  }
}
