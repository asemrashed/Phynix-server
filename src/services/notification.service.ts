import type { Notification } from "@prisma/client"
import type { NotificationItem } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { emitNotificationUpdate } from "../lib/notification-emit"

export function toNotificationItem(n: Notification): NotificationItem {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }
}

async function emitState(
  userId: string,
  extra?: { notification?: NotificationItem; deletedId?: string }
) {
  const unreadCount = await getUnreadCount(userId)
  emitNotificationUpdate(userId, { unreadCount, ...extra })
}

/** @deprecated Prefer notifyUser() from notification-dispatch.service for email + in-app */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string
) {
  const row = await prisma.notification.create({
    data: { userId, type, title, message, link },
  })
  const notification = toNotificationItem(row)
  await emitState(userId, { notification })
  return row
}

export async function getUserNotifications(userId: string): Promise<NotificationItem[]> {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return notifications.map(toNotificationItem)
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  })

  if (result.count === 0) {
    throw Object.assign(new Error("Notification not found"), { code: "NOT_FOUND" })
  }

  await emitState(userId)
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })

  await emitState(userId)
}

export async function deleteNotification(userId: string, notificationId: string) {
  const result = await prisma.notification.deleteMany({
    where: { id: notificationId, userId },
  })

  if (result.count === 0) {
    throw Object.assign(new Error("Notification not found"), { code: "NOT_FOUND" })
  }

  await emitState(userId, { deletedId: notificationId })
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  })
}

export async function emitNotificationCreated(userId: string, notification: NotificationItem) {
  await emitState(userId, { notification })
}
