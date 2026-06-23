import { prisma } from "../lib/prisma"
import {
  getGraceEndsAt,
  SUBSCRIPTION_GRACE_DAYS,
} from "../lib/subscription-utils"
import {
  getSubscriptionReminderFlags,
} from "../services/subscription.service"
import {
  sendSubscriptionExpiredEmail,
  sendSubscriptionExpiryReminderEmail,
} from "../services/email.service"
import { invalidatePremiumAccessCache } from "../lib/premium-cache"
import { logger } from "../lib/logger"

type ReminderFlags = {
  sevenDay?: string
  oneDay?: string
  expired?: string
}

async function getStudentEmail(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { email: true } } },
  })
  if (!student) return null
  return {
    email: student.user.email,
    firstName: student.firstName,
  }
}

export async function processSubscriptionLifecycle() {
  const now = new Date()
  let movedToGrace = 0
  let downgraded = 0
  let reminders = 0

  const activeExpired = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      plan: { notIn: ["FREE", "LIFETIME"] },
      expiresAt: { lt: now },
    },
  })

  for (const sub of activeExpired) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "GRACE" },
    })
    await invalidatePremiumAccessCache(sub.studentId)
    movedToGrace++

    const contact = await getStudentEmail(sub.studentId)
    if (contact) {
      await sendSubscriptionExpiredEmail(
        contact.email,
        contact.firstName,
        sub.plan,
        SUBSCRIPTION_GRACE_DAYS
      )
    }
  }

  const inGrace = await prisma.subscription.findMany({
    where: { status: "GRACE", expiresAt: { not: null } },
  })

  for (const sub of inGrace) {
    const graceEnds = getGraceEndsAt(sub.expiresAt)
    if (!graceEnds || graceEnds >= now) continue

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        plan: "FREE",
        status: "CANCELLED",
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        expiresAt: null,
        reminderFlags: {},
      },
    })
    await invalidatePremiumAccessCache(sub.studentId)
    downgraded++
  }

  const activePaid = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      plan: { notIn: ["FREE", "LIFETIME"] },
      expiresAt: { not: null },
    },
  })

  for (const sub of activePaid) {
    if (!sub.expiresAt) continue

    const daysLeft = Math.ceil(
      (sub.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    )
    const flags = getSubscriptionReminderFlags(sub.reminderFlags)
    const contact = await getStudentEmail(sub.studentId)
    if (!contact) continue

    const updatedFlags: ReminderFlags = { ...flags }

    if (daysLeft <= 7 && daysLeft > 1 && !flags.sevenDay) {
      await sendSubscriptionExpiryReminderEmail(
        contact.email,
        contact.firstName,
        sub.plan,
        daysLeft,
        sub.cancelAtPeriodEnd
      )
      updatedFlags.sevenDay = now.toISOString()
      reminders++
    }

    if (daysLeft <= 1 && daysLeft >= 0 && !flags.oneDay) {
      await sendSubscriptionExpiryReminderEmail(
        contact.email,
        contact.firstName,
        sub.plan,
        daysLeft,
        sub.cancelAtPeriodEnd
      )
      updatedFlags.oneDay = now.toISOString()
      reminders++
    }

    if (
      Object.keys(updatedFlags).length >
      Object.keys(flags).length
    ) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { reminderFlags: updatedFlags },
      })
    }
  }

  if (movedToGrace > 0 || downgraded > 0 || reminders > 0) {
    logger.info(
      { movedToGrace, downgraded, reminders },
      "Subscription lifecycle processed"
    )
  }

  return { movedToGrace, downgraded, reminders }
}

export function startSubscriptionLifecycleScheduler() {
  const intervalMs = Number(
    process.env.SUBSCRIPTION_LIFECYCLE_INTERVAL_MS || 60 * 60 * 1000
  )

  setInterval(() => {
    processSubscriptionLifecycle().catch((err) => {
      console.error("[Subscription Lifecycle] Failed:", err)
    })
  }, intervalMs)

  processSubscriptionLifecycle().catch(console.error)
  console.log(
    `[Subscription Lifecycle] Scheduler started (every ${intervalMs / 60000}min)`
  )
}
