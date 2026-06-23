import { processMentorReminders } from "../services/mentor.service"

const INTERVAL_MS = Number(process.env.MENTOR_REMINDER_INTERVAL_MS || 900_000)

export function startMentorReminderScheduler() {
  const run = async () => {
    try {
      const { sent } = await processMentorReminders()
      if (sent > 0) {
        console.log(`[Mentor Reminders] Sent ${sent} reminder email(s)`)
      }
    } catch (err) {
      console.error("[Mentor Reminders] Error:", err)
    }
  }

  run()
  setInterval(run, INTERVAL_MS)
  console.log(`Mentor reminder scheduler started (every ${INTERVAL_MS / 1000}s)`)
}
