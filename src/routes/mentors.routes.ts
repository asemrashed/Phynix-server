import { Router } from "express"
import * as ctrl from "../controllers/mentor.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"
import { requireEmailVerified } from "../middlewares/email-verification.middleware"

const router = Router()

router.get("/bookings/me", authMiddleware, touchDeviceSession, ctrl.getMyBookings)
router.post(
  "/bookings/:bookingId/cancel",
  authMiddleware,
  touchDeviceSession,
  ctrl.cancelBooking
)
router.post(
  "/bookings/:bookingId/reschedule",
  authMiddleware,
  touchDeviceSession,
  ctrl.rescheduleBooking
)
router.post(
  "/bookings/:bookingId/review",
  authMiddleware,
  touchDeviceSession,
  ctrl.reviewBooking
)
router.get("/:mentorId/slots", ctrl.getSlots)
router.post(
  "/slots/:slotId/book",
  authMiddleware,
  touchDeviceSession,
  requireEmailVerified,
  ctrl.bookSlot
)

export default router
