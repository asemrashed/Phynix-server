import { Router } from "express"
import * as paymentController from "../controllers/payment.controller"
import * as manualPaymentController from "../controllers/manual-payment.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"
import { requireEmailVerified } from "../middlewares/email-verification.middleware"
import { blockInProduction } from "../middlewares/production-guard.middleware"
import { paymentLimiter, webhookLimiter } from "../middlewares/rate-limit.middleware"
import { thumbnailUpload } from "../middlewares/upload.middleware"

const router = Router()

router.get("/config", paymentController.getPaymentConfig)
router.get("/installments/plans/:courseId", manualPaymentController.getCourseInstallmentPlans)
router.post(
  "/create-session",
  paymentLimiter,
  authMiddleware,
  touchDeviceSession,
  requireEmailVerified,
  paymentController.createSession
)
router.post(
  "/sslcommerz/create",
  paymentLimiter,
  authMiddleware,
  touchDeviceSession,
  requireEmailVerified,
  paymentController.createSSLPayment
)
router.get("/manual/:paymentId", authMiddleware, touchDeviceSession, manualPaymentController.getManualPayment)
router.post(
  "/manual/:paymentId/submit-proof",
  paymentLimiter,
  authMiddleware,
  touchDeviceSession,
  requireEmailVerified,
  manualPaymentController.postManualPaymentProof
)
router.post(
  "/manual/:paymentId/proof-image",
  paymentLimiter,
  authMiddleware,
  touchDeviceSession,
  requireEmailVerified,
  thumbnailUpload.single("file"),
  manualPaymentController.uploadManualPaymentProofImage
)
router.post(
  "/installments/agreement",
  paymentLimiter,
  authMiddleware,
  touchDeviceSession,
  requireEmailVerified,
  manualPaymentController.postInstallmentAgreement
)
router.get(
  "/installments/my",
  authMiddleware,
  touchDeviceSession,
  manualPaymentController.getMyInstallments
)
router.post(
  "/installments/:installmentPaymentId/pay",
  paymentLimiter,
  authMiddleware,
  touchDeviceSession,
  requireEmailVerified,
  manualPaymentController.postInstallmentPayment
)
router.get("/sslcommerz/init/:paymentId", paymentController.sslcommerzInit)
router.post("/sslcommerz/ipn", webhookLimiter, paymentController.sslcommerzIPN)
router.get("/sslcommerz/success", paymentController.sslcommerzSuccess)
router.get("/sslcommerz/fail", paymentController.sslcommerzFail)
router.get("/sslcommerz/cancel", paymentController.sslcommerzCancel)
router.post(
  "/simulate/:paymentId",
  blockInProduction,
  paymentLimiter,
  authMiddleware,
  touchDeviceSession,
  requireEmailVerified,
  paymentController.simulatePayment
)
router.get(
  "/:paymentId/status",
  authMiddleware,
  touchDeviceSession,
  paymentController.getPaymentStatusHandler
)

export default router
