import { Router } from "express"
import * as ctrl from "../controllers/product.controller"
import { authMiddleware, optionalAuth } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"
import { requireEmailVerified } from "../middlewares/email-verification.middleware"

const router = Router()

router.get("/marketplace", optionalAuth, ctrl.getMarketplace)
router.get("/digital/by-slug/:slug", optionalAuth, ctrl.getDigitalProductDetail)
router.get("/physical/by-slug/:slug", ctrl.getPhysicalProductDetail)
router.get("/physical/:productId", ctrl.getPhysicalProductByIdHandler)
router.get("/digital", optionalAuth, ctrl.getDigitalProducts)
router.get("/digital/purchases/me", authMiddleware, touchDeviceSession, ctrl.getMyPurchases)
router.post("/digital/:productId/purchase", authMiddleware, touchDeviceSession, ctrl.purchaseProduct)
router.get("/digital/:productId/download", authMiddleware, touchDeviceSession, ctrl.downloadProduct)
router.get("/physical", ctrl.getPhysicalProducts)
router.post(
  "/orders",
  authMiddleware,
  touchDeviceSession,
  requireEmailVerified,
  ctrl.placeOrder
)
router.get("/orders/me", authMiddleware, touchDeviceSession, ctrl.getMyOrders)
router.get("/orders/me/:orderId", authMiddleware, touchDeviceSession, ctrl.getMyOrder)
router.patch("/orders/me/:orderId", authMiddleware, touchDeviceSession, ctrl.patchMyOrder)

export default router
