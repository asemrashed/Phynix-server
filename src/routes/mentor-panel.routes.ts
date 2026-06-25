import { Router } from "express"
import * as ctrl from "../controllers/mentor-panel.controller"
import { authMiddleware, requireRole } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"

const router = Router()

router.use(authMiddleware, requireRole("INSTRUCTOR"), touchDeviceSession)

router.get("/stats", ctrl.getStats)
router.get("/profile", ctrl.getProfile)
router.patch("/profile", ctrl.patchProfile)
router.get("/bookings", ctrl.getBookings)
router.get("/slots", ctrl.getSlots)
router.post("/slots", ctrl.postSlot)
router.delete("/slots/:slotId", ctrl.removeSlot)
router.patch("/bookings/:bookingId/notes", ctrl.patchBookingNotes)

export default router
