import { Router } from "express"
import * as certificateController from "../controllers/certificate.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"

const router = Router()

router.get("/", authMiddleware, touchDeviceSession, certificateController.getCertificates)
router.get("/:certCode/qr", certificateController.qrCode)
router.get("/:certCode/download", authMiddleware, certificateController.download)
router.get("/:certCode/verify", certificateController.verify)

export default router
