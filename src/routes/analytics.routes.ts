import { Router } from "express"
import * as ctrl from "../controllers/analytics.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"

const router = Router()

router.get("/me", authMiddleware, touchDeviceSession, ctrl.getMyAnalytics)

export default router
