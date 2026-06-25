import { Router } from "express"
import * as courseController from "../controllers/course.controller"
import * as videoController from "../controllers/video.controller"
import { authMiddleware, optionalAuth, requireRole } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"
import { requireEmailVerified } from "../middlewares/email-verification.middleware"

const router = Router()

router.get("/", optionalAuth, courseController.getCourses)
router.get("/enrollments/me", authMiddleware, touchDeviceSession, courseController.getMyEnrollments)
router.get("/:courseId/reviews", courseController.getCourseReviews)
router.post(
  "/:courseId/reviews",
  authMiddleware,
  touchDeviceSession,
  courseController.submitReview
)
router.get(
  "/:courseId/lessons/:lessonId/preview",
  videoController.getPreviewToken
)
router.get("/:slug", optionalAuth, courseController.getCourse)
router.post(
  "/:courseId/enroll",
  authMiddleware,
  requireRole("STUDENT"),
  touchDeviceSession,
  requireEmailVerified,
  courseController.enroll
)
router.get("/:courseId/progress", authMiddleware, touchDeviceSession, courseController.getProgress)
router.get(
  "/:courseId/lessons/:lessonId",
  authMiddleware,
  touchDeviceSession,
  courseController.getLesson
)
router.post(
  "/:courseId/lessons/:lessonId/progress",
  authMiddleware,
  touchDeviceSession,
  courseController.updateProgress
)
router.get(
  "/:courseId/lessons/:lessonId/token",
  authMiddleware,
  touchDeviceSession,
  videoController.getToken
)
router.get("/:courseId/lessons/:lessonId/stream", videoController.streamVideo)

export default router
