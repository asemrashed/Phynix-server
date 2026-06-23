import { processLiveSessionReminders } from "../services/session.service"

const INTERVAL_MS = Number(process.env.LIVE_SESSION_REMINDER_INTERVAL_MS || 900_000)

export function startLiveSessionReminderScheduler() {
  const run = async () => {
    try {
      const { sent } = await processLiveSessionReminders()
      if (sent > 0) {
        console.log(`[Live Session Reminders] Sent ${sent} reminder email(s)`)
      }
    } catch (err) {
      console.error("[Live Session Reminders] Error:", err)
    }
  }

  run()
  setInterval(run, INTERVAL_MS)
  console.log(`Live session reminder scheduler started (every ${INTERVAL_MS / 1000}s)`)
}
