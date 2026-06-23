import { Router } from "express"
import * as ctrl from "../controllers/subscription.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"
import { requireEmailVerified } from "../middlewares/email-verification.middleware"

const router = Router()

router.get("/plans", ctrl.getPlans)
router.get("/me", authMiddleware, touchDeviceSession, ctrl.getMySubscription)
router.post(
  "/subscribe",
  authMiddleware,
  touchDeviceSession,
  requireEmailVerified,
  ctrl.subscribe
)
router.post("/cancel", authMiddleware, touchDeviceSession, ctrl.cancelSubscription)
router.post("/reactivate", authMiddleware, touchDeviceSession, ctrl.reactivateSubscriptionHandler)

export default router
