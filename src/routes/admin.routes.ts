import { Router } from "express"
import * as adminController from "../controllers/admin.controller"
import * as courseAdminController from "../controllers/course-admin.controller"
import * as productAdminController from "../controllers/product-admin.controller"
import * as mentorSessionAdminController from "../controllers/mentor-session-admin.controller"
import * as userAdminController from "../controllers/user-admin.controller"
import * as certificateAdminController from "../controllers/certificate-admin.controller"
import * as communityAdminController from "../controllers/community-admin.controller"
import * as testimonialController from "../controllers/testimonial.controller"
import * as paymentSettingsController from "../controllers/payment-settings.controller"
import * as manualPaymentController from "../controllers/manual-payment.controller"
import * as contactController from "../controllers/contact.controller"
import * as siteCmsController from "../controllers/site-cms.controller"
import { authMiddleware, requireRole } from "../middlewares/auth.middleware"
import {
  thumbnailUpload,
  digitalFileUpload,
  productImageUpload,
  courseVideoUpload,
} from "../middlewares/upload.middleware"

const router = Router()

router.use(authMiddleware)
router.use(requireRole("ADMIN", "SUPER_ADMIN"))

router.get("/stats", adminController.getStats)
router.get("/users", adminController.getUsers)
router.get("/users/:userId", userAdminController.getUserDetail)
router.patch("/users/:userId", userAdminController.patchUserDetail)
router.post("/users/:userId/enrollments", userAdminController.postUserEnrollment)
router.post("/users/:userId/reset-devices", userAdminController.resetDeviceSessions)
router.get("/instructors", courseAdminController.getInstructors)
router.get("/courses", adminController.getCourses)
router.post("/courses", courseAdminController.postCourse)
router.get("/courses/:courseId", courseAdminController.getCourseDetail)
router.get("/courses/:courseId/students", courseAdminController.getCourseStudents)
router.get("/courses/:courseId/reviews", courseAdminController.getCourseReviews)
router.patch("/courses/:courseId", courseAdminController.patchCourseDetail)
router.delete("/courses/:courseId", courseAdminController.removeCourse)
router.post("/courses/:courseId/sections", courseAdminController.postSection)
router.patch("/courses/:courseId/sections/reorder", courseAdminController.reorderCourseSections)
router.patch("/courses/:courseId/sections/:sectionId", courseAdminController.patchSection)
router.delete("/courses/:courseId/sections/:sectionId", courseAdminController.removeSection)
router.post("/courses/:courseId/sections/:sectionId/lessons", courseAdminController.postLesson)
router.patch(
  "/courses/:courseId/sections/:sectionId/lessons/reorder",
  courseAdminController.reorderSectionLessons
)
router.patch(
  "/courses/:courseId/sections/:sectionId/lessons/:lessonId",
  courseAdminController.patchLesson
)
router.delete(
  "/courses/:courseId/sections/:sectionId/lessons/:lessonId",
  courseAdminController.removeLesson
)
router.post(
  "/courses/:courseId/sections/:sectionId/lessons/:lessonId/upload-video",
  courseVideoUpload.single("file"),
  courseAdminController.uploadCourseVideo
)
router.post(
  "/uploads/thumbnail",
  thumbnailUpload.single("file"),
  courseAdminController.uploadThumbnail
)
router.post(
  "/uploads/digital-file",
  digitalFileUpload.single("file"),
  productAdminController.uploadDigitalFile
)
router.post(
  "/uploads/product-images",
  productImageUpload.array("files", 10),
  productAdminController.uploadProductImages
)
router.get("/blog", adminController.getBlogPosts)
router.get("/blog/categories", adminController.getBlogCategories)
router.post("/blog/categories", adminController.postBlogCategory)
router.patch("/blog/categories/:categoryId", adminController.patchBlogCategory)
router.delete("/blog/categories/:categoryId", adminController.removeBlogCategory)
router.post("/blog", adminController.createBlog)
router.get("/blog/:postId", adminController.getBlogPostDetail)
router.patch("/blog/:postId", adminController.patchBlogPost)
router.get("/products/digital", adminController.getDigitalProducts)
router.post("/products/digital", productAdminController.postDigitalProduct)
router.get("/products/digital/:productId", productAdminController.getDigitalProductDetail)
router.patch("/products/digital/:productId", productAdminController.patchDigitalProductDetail)
router.get("/products/physical", adminController.getPhysicalProducts)
router.post("/products/physical", productAdminController.postPhysicalProduct)
router.get("/products/physical/:productId", productAdminController.getPhysicalProductDetail)
router.patch("/products/physical/:productId", productAdminController.patchPhysicalProductDetail)
router.get("/sessions", mentorSessionAdminController.getLiveSessions)
router.post("/sessions", mentorSessionAdminController.postLiveSession)
router.get("/sessions/:sessionId", mentorSessionAdminController.getLiveSessionDetail)
router.patch("/sessions/:sessionId", mentorSessionAdminController.patchLiveSession)
router.post("/sessions/:sessionId/cancel", mentorSessionAdminController.cancelSession)
router.get(
  "/sessions/:sessionId/registrations/export",
  mentorSessionAdminController.exportLiveSessionRegistrations
)
router.get(
  "/sessions/:sessionId/registrations/candidates",
  mentorSessionAdminController.getLiveSessionRegistrationCandidates
)
router.post(
  "/sessions/:sessionId/registrations",
  mentorSessionAdminController.postLiveSessionRegistration
)
router.get(
  "/sessions/:sessionId/registrations",
  mentorSessionAdminController.getLiveSessionRegistrations
)
router.patch(
  "/sessions/:sessionId/registrations/:registrationId",
  mentorSessionAdminController.patchLiveSessionRegistration
)
router.get("/orders", adminController.getOrders)
router.get("/orders/:orderId", adminController.getOrder)
router.patch("/orders/:orderId", adminController.patchOrder)
router.delete("/orders/:orderId", adminController.removeOrder)
router.get("/payments", adminController.getPayments)
router.get("/payments/pending", manualPaymentController.getPendingPayments)
router.post("/payments/:paymentId/approve", manualPaymentController.approvePayment)
router.post("/payments/:paymentId/reject", manualPaymentController.rejectPayment)
router.get("/payment-settings", paymentSettingsController.getPaymentSettings)
router.patch("/payment-settings", paymentSettingsController.updatePaymentSettings)
router.post(
  "/uploads/payment-qr",
  thumbnailUpload.single("file"),
  manualPaymentController.uploadPaymentQr
)
router.patch("/payment-settings/manual/:provider", manualPaymentController.patchManualPaymentMethod)
router.post("/installment-plans", manualPaymentController.postInstallmentPlan)
router.get("/installment-plans", manualPaymentController.getInstallmentPlans)
router.patch("/installment-plans/:planId", manualPaymentController.patchInstallmentPlan)
router.post("/payments/:paymentId/refund", adminController.refundPayment)
router.get("/certificates/stats", certificateAdminController.getStats)
router.get("/certificates/failed", certificateAdminController.getFailed)
router.get("/certificates/export", certificateAdminController.exportCsv)
router.post("/certificates/issue", certificateAdminController.issue)
router.post("/certificates/retry", certificateAdminController.retry)
router.get("/certificates", certificateAdminController.getCertificates)
router.post("/certificates/:certificateId/regenerate", certificateAdminController.regenerate)
router.post("/certificates/:certificateId/revoke", certificateAdminController.revoke)
router.get("/community", communityAdminController.getAdminPosts)
router.post("/community", communityAdminController.createAdminPost)
router.get("/community/:postId/reports", communityAdminController.getAdminPostReports)
router.get("/community/:postId", communityAdminController.getAdminPostDetail)
router.patch("/community/:postId", communityAdminController.patchAdminPost)
router.get("/testimonials", testimonialController.getAdminTestimonials)
router.post("/testimonials", testimonialController.postTestimonial)
router.get("/testimonials/:testimonialId", testimonialController.getAdminTestimonialDetail)
router.patch("/testimonials/:testimonialId", testimonialController.patchTestimonial)
router.delete("/testimonials/:testimonialId", testimonialController.removeTestimonial)
router.get("/inquiries", contactController.getAdminInquiries)
router.get("/inquiries/:inquiryId", contactController.getAdminInquiryDetail)
router.patch("/inquiries/:inquiryId", contactController.patchAdminInquiry)

router.get("/site/settings", siteCmsController.getAdminSiteSettingsHandler)
router.patch("/site/settings", siteCmsController.patchAdminSiteSettings)
router.patch("/site/footer", siteCmsController.patchAdminSiteFooter)
router.get("/site/pages", siteCmsController.getAdminSitePages)
router.get("/site/pages/:slug", siteCmsController.getAdminSitePageDetail)
router.patch("/site/pages/:slug", siteCmsController.patchAdminSitePage)
router.get("/site/homepage", siteCmsController.getAdminHomepageSections)
router.get("/site/homepage/:key", siteCmsController.getAdminHomepageSectionDetail)
router.patch("/site/homepage/:key", siteCmsController.patchAdminHomepageSection)

export default router
