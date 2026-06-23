import "dotenv/config"
import { createServer } from "http"
import { validateEnv } from "./config/env"
import { createApp } from "./app"
import { initSocket } from "./lib/socket"
import { startOrderCleanupScheduler } from "./jobs/order-cleanup.job"
import { startSubscriptionLifecycleScheduler } from "./jobs/subscription-lifecycle.job"
import { startBlogPublishScheduler } from "./jobs/blog-publish.job"
import { startLiveSessionReminderScheduler } from "./jobs/live-session-reminders.job"
import { startPaymentLifecycleScheduler } from "./jobs/payment-lifecycle.job"
import { startReviewReminderScheduler } from "./jobs/review-reminders.job"

const env = validateEnv()
const app = createApp()

async function start() {
  startOrderCleanupScheduler()
  startSubscriptionLifecycleScheduler()
  startBlogPublishScheduler()
  startLiveSessionReminderScheduler()
  startPaymentLifecycleScheduler()
  startReviewReminderScheduler()

  const server = createServer(app)
  initSocket(server)

  server.listen(env.PORT, () => {
    console.log(`FX Prime API running on http://localhost:${env.PORT}`)
    console.log(`Health check: http://localhost:${env.PORT}/api/v1/health`)
    console.log(`WebSocket: ws://localhost:${env.PORT}/socket.io`)
  })
}

start()
