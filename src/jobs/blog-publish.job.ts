import { prisma } from "../lib/prisma"

export async function processScheduledBlogPosts() {
  const now = new Date()

  const result = await prisma.blogPost.updateMany({
    where: {
      status: "DRAFT",
      publishedAt: { lte: now, not: null },
    },
    data: { status: "PUBLISHED" },
  })

  return result.count
}

export function startBlogPublishScheduler() {
  const intervalMs = Number(process.env.BLOG_PUBLISH_INTERVAL_MS || 60_000)

  const run = async () => {
    try {
      const count = await processScheduledBlogPosts()
      if (count > 0) {
        console.log(`[BlogPublish] Published ${count} scheduled post(s)`)
      }
    } catch (err) {
      console.error("[BlogPublish] Error:", err)
    }
  }

  run()
  setInterval(run, intervalMs)
  console.log(`[BlogPublish] Scheduler started (every ${intervalMs}ms)`)
}
