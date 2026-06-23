import { Router } from "express"
import * as ctrl from "../controllers/session.controller"
import { authMiddleware, optionalAuth } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"

const router = Router()

router.get("/hub", optionalAuth, ctrl.getLiveHubSessions)
router.get("/", optionalAuth, ctrl.getSessions)
router.get("/:sessionId/preview", optionalAuth, ctrl.getSessionPreviewHandler)
router.post("/:sessionId/register", authMiddleware, touchDeviceSession, ctrl.registerSession)
router.get("/:sessionId/join", authMiddleware, touchDeviceSession, ctrl.joinSession)

export default router
