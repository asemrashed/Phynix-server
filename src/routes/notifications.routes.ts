import { Router } from "express"
import * as notificationController from "../controllers/notification.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"

const router = Router()

router.get("/", authMiddleware, touchDeviceSession, notificationController.getNotifications)
router.patch("/read-all", authMiddleware, touchDeviceSession, notificationController.markAllRead)
router.patch(
  "/:notificationId/read",
  authMiddleware,
  touchDeviceSession,
  notificationController.markRead
)
router.delete(
  "/:notificationId",
  authMiddleware,
  touchDeviceSession,
  notificationController.removeNotification
)

export default router
