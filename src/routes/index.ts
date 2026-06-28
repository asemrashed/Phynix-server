import { Router } from "express"
import authRoutes from "./auth.routes"
import courseRoutes from "./courses.routes"
import paymentRoutes from "./payments.routes"
import certificateRoutes from "./certificates.routes"
import notificationRoutes from "./notifications.routes"
import statsRoutes from "./stats.routes"
import adminRoutes from "./admin.routes"
import subscriptionRoutes from "./subscription.routes"
import productRoutes from "./products.routes"
import blogRoutes from "./blog.routes"
import bookmarkRoutes from "./bookmarks.routes"
import analyticsRoutes from "./analytics.routes"
import sessionRoutes from "./sessions.routes"
import communityRoutes from "./community.routes"
import studentsRoutes from "./students.routes"
import searchRoutes from "./search.routes"
import instructorRoutes from "./instructor.routes"
import testimonialRoutes from "./testimonials.routes"
import reviewRoutes from "./reviews.routes"
import contactRoutes from "./contact.routes"
import siteRoutes from "./site.routes"

const router = Router()

router.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } })
})

router.use("/auth", authRoutes)
router.use("/courses", courseRoutes)
router.use("/payments", paymentRoutes)
router.use("/certificates", certificateRoutes)
router.use("/notifications", notificationRoutes)
router.use("/stats", statsRoutes)
router.use("/admin", adminRoutes)
router.use("/subscription", subscriptionRoutes)
router.use("/products", productRoutes)
router.use("/blog", blogRoutes)
router.use("/bookmarks", bookmarkRoutes)
router.use("/analytics", analyticsRoutes)
router.use("/sessions", sessionRoutes)
router.use("/community", communityRoutes)
router.use("/students", studentsRoutes)
router.use("/search", searchRoutes)
router.use("/instructor", instructorRoutes)
router.use("/testimonials", testimonialRoutes)
router.use("/reviews", reviewRoutes)
router.use("/contact", contactRoutes)
router.use("/site", siteRoutes)

export default router
