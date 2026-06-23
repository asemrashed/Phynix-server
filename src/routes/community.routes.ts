import { Router } from "express"
import rateLimit from "express-rate-limit"
import * as ctrl from "../controllers/community.controller"
import { authMiddleware, optionalAuth } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"

const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMIT", message: "Too many posts" } },
})

const router = Router()

router.get("/", optionalAuth, ctrl.getPosts)
router.get("/:postId", optionalAuth, ctrl.getPost)
router.post("/", authMiddleware, touchDeviceSession, postLimiter, ctrl.createPost)
router.post("/:postId/replies", authMiddleware, touchDeviceSession, postLimiter, ctrl.createReply)
router.patch("/:postId", authMiddleware, touchDeviceSession, ctrl.updatePost)
router.delete("/:postId", authMiddleware, touchDeviceSession, ctrl.removePost)
router.post("/:postId/like", authMiddleware, touchDeviceSession, ctrl.likePost)
router.post("/:postId/react", authMiddleware, touchDeviceSession, ctrl.reactToPost)
router.post("/:postId/report", authMiddleware, touchDeviceSession, ctrl.reportPost)

export default router
