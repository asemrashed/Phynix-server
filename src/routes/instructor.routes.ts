import { Router } from "express"
import * as ctrl from "../controllers/instructor.controller"
import { authMiddleware, requireRole } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"
import { avatarUpload } from "../middlewares/upload.middleware"

const router = Router()

router.use(authMiddleware, requireRole("INSTRUCTOR"), touchDeviceSession)

router.get("/stats", ctrl.getStats)
router.get("/profile", ctrl.getProfile)
router.patch("/profile", ctrl.patchProfile)
router.post("/profile/photo", avatarUpload.single("photo"), ctrl.uploadPhoto)
router.get("/analytics", ctrl.getAnalytics)
router.get("/courses", ctrl.getMyCourses)
router.get("/courses/:slug/students", ctrl.getCourseStudents)
router.get("/courses/:slug/reviews", ctrl.getCourseReviews)
router.get("/courses/:slug", ctrl.getCourseDetail)

export default router
