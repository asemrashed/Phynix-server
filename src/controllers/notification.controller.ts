import { Request, Response, NextFunction } from "express"
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getUnreadCount,
} from "../services/notification.service"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"

export async function getNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }
    const notifications = await getUserNotifications(req.user.userId)
    const unreadCount = await getUnreadCount(req.user.userId)
    return sendSuccess(res, { notifications, unreadCount })
  } catch (err) {
    next(err)
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }
    const notificationId = param(req.params.notificationId)
    await markNotificationRead(req.user.userId, notificationId)
    return sendSuccess(res, { message: "Notification marked as read" })
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }
    await markAllNotificationsRead(req.user.userId)
    return sendSuccess(res, { message: "All notifications marked as read" })
  } catch (err) {
    next(err)
  }
}

export async function removeNotification(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }
    const notificationId = param(req.params.notificationId)
    await deleteNotification(req.user.userId, notificationId)
    return sendSuccess(res, { message: "Notification deleted" })
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}
