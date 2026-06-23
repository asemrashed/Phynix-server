import { Router } from "express"
import * as portfolioController from "../controllers/portfolio.controller"
import * as cvController from "../controllers/cv.controller"
import * as learningGoalsController from "../controllers/learning-goals.controller"
import * as addressController from "../controllers/address.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"

const router = Router()

router.get(
  "/me/portfolio",
  authMiddleware,
  touchDeviceSession,
  portfolioController.getMyPortfolio
)
router.get("/me/cv", authMiddleware, touchDeviceSession, cvController.getMyCv)
router.patch("/me/cv", authMiddleware, touchDeviceSession, cvController.patchMyCv)
router.post("/me/cv/pdf", authMiddleware, touchDeviceSession, cvController.downloadMyCvPdf)
router.get(
  "/me/learning-goals",
  authMiddleware,
  touchDeviceSession,
  learningGoalsController.getMyLearningGoals
)
router.get("/me/addresses", authMiddleware, touchDeviceSession, addressController.getAddresses)
router.post("/me/addresses", authMiddleware, touchDeviceSession, addressController.postAddress)
router.patch(
  "/me/addresses/:addressId",
  authMiddleware,
  touchDeviceSession,
  addressController.patchAddress
)
router.delete(
  "/me/addresses/:addressId",
  authMiddleware,
  touchDeviceSession,
  addressController.removeAddress
)

export default router
