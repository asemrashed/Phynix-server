import { processCourseReviewReminders } from "../services/review-reminder.service"

const INTERVAL_MS = Number(process.env.REVIEW_REMINDER_INTERVAL_MS || 3_600_000)

export function startReviewReminderScheduler() {
  const run = async () => {
    try {
      const { sent } = await processCourseReviewReminders()
      if (sent > 0) {
        console.log(`[Review Reminders] Sent ${sent} reminder(s)`)
      }
    } catch (err) {
      console.error("[Review Reminders] Error:", err)
    }
  }

  run()
  setInterval(run, INTERVAL_MS)
  console.log(`Review reminder scheduler started (every ${INTERVAL_MS / 1000}s)`)
}
