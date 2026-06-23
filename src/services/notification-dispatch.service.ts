import { prisma } from "../lib/prisma"
import {
  emitNotificationCreated,
  toNotificationItem,
} from "./notification.service"
import {
  sendMentorBookingEmail,
  sendMentorCancelledEmail,
  sendMentorRescheduledEmail,
  sendMentorReminderEmail,
  sendLiveSessionCancelledEmail,
  sendLiveSessionRegisteredEmail,
  sendLiveSessionReminderEmail,
  sendDigitalProductEmail,
  sendOrderConfirmationEmail,
  sendSubscriptionEmail,
} from "./email.service"

const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000"

export type NotificationEmailTemplate =
  | {
      name: "mentor_booking"
      mentorName: string
      scheduledAt: string
      consultationTypeLabel?: string
    }
  | { name: "mentor_cancelled"; mentorName: string; scheduledAt: string }
  | { name: "mentor_rescheduled"; mentorName: string; scheduledAt: string }
  | { name: "mentor_reminder"; mentorName: string; scheduledAt: string; hoursBefore: 24 | 1 }
  | { name: "live_session_cancelled"; sessionTitle: string; scheduledAt: string }
  | { name: "live_session_registered"; sessionTitle: string; scheduledAt: string }
  | {
      name: "live_session_reminder"
      sessionTitle: string
      scheduledAt: string
      hoursBefore: 24 | 1
    }
  | { name: "digital_product"; productTitle: string }
  | { name: "order_confirmation"; orderCode: string; total: number; currency: string }
  | { name: "subscription"; plan: string }

export interface NotifyUserOptions {
  userId: string
  type: string
  title: string
  message: string
  link?: string
  email?: {
    to: string
    firstName: string
    template: NotificationEmailTemplate
  }
}

async function sendNotificationEmail(
  to: string,
  firstName: string,
  template: NotificationEmailTemplate
) {
  switch (template.name) {
    case "mentor_booking":
      return sendMentorBookingEmail(
        to,
        firstName,
        template.mentorName,
        template.scheduledAt,
        undefined,
        template.consultationTypeLabel
      )
    case "mentor_cancelled":
      return sendMentorCancelledEmail(to, firstName, template.mentorName, template.scheduledAt)
    case "mentor_rescheduled":
      return sendMentorRescheduledEmail(to, firstName, template.mentorName, template.scheduledAt)
    case "mentor_reminder":
      return sendMentorReminderEmail(
        to,
        firstName,
        template.mentorName,
        template.scheduledAt,
        template.hoursBefore
      )
    case "live_session_cancelled":
      return sendLiveSessionCancelledEmail(
        to,
        firstName,
        template.sessionTitle,
        template.scheduledAt
      )
    case "live_session_registered":
      return sendLiveSessionRegisteredEmail(
        to,
        firstName,
        template.sessionTitle,
        template.scheduledAt
      )
    case "live_session_reminder":
      return sendLiveSessionReminderEmail(
        to,
        firstName,
        template.sessionTitle,
        template.scheduledAt,
        template.hoursBefore
      )
    case "digital_product":
      return sendDigitalProductEmail(to, firstName, template.productTitle)
    case "order_confirmation":
      return sendOrderConfirmationEmail(
        to,
        firstName,
        template.orderCode,
        template.total,
        template.currency
      )
    case "subscription":
      return sendSubscriptionEmail(to, firstName, template.plan)
  }
}

/** Unified entry: in-app notification + optional transactional email */
export async function notifyUser(options: NotifyUserOptions) {
  const notification = await prisma.notification.create({
    data: {
      userId: options.userId,
      type: options.type,
      title: options.title,
      message: options.message,
      link: options.link,
    },
  })

  if (options.email) {
    await sendNotificationEmail(
      options.email.to,
      options.email.firstName,
      options.email.template
    )
  }

  await emitNotificationCreated(options.userId, toNotificationItem(notification))

  return notification
}
