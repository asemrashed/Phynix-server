import { Router } from "express"
import * as authController from "../controllers/auth.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"
import { avatarUpload } from "../middlewares/upload.middleware"

const router = Router()

router.post("/register", authController.register)
router.get("/verify-email", authController.verifyEmailHandler)
router.post("/resend-verification", authMiddleware, authController.resendVerification)
router.post("/forgot-password", authController.forgotPassword)
router.post("/reset-password", authController.resetPasswordHandler)
router.post("/login", authController.login)
router.post("/refresh", authController.refresh)
router.post("/clear-session", authController.clearSession)
router.post("/logout", authMiddleware, touchDeviceSession, authController.logout)
router.post("/force-logout", authMiddleware, authController.forceLogout)
router.get("/me", authMiddleware, touchDeviceSession, authController.me)
router.patch("/profile", authMiddleware, touchDeviceSession, authController.updateProfile)
router.post(
  "/avatar",
  authMiddleware,
  touchDeviceSession,
  avatarUpload.single("avatar"),
  authController.uploadAvatar
)

export default router
