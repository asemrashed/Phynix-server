import { Router } from "express"
import * as ctrl from "../controllers/bookmark.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { touchDeviceSession } from "../middlewares/device.middleware"

const router = Router()

router.get("/status", authMiddleware, touchDeviceSession, ctrl.getStatus)
router.get("/", authMiddleware, touchDeviceSession, ctrl.listBookmarks)
router.post("/", authMiddleware, touchDeviceSession, ctrl.createBookmark)
router.delete("/:id", authMiddleware, touchDeviceSession, ctrl.deleteBookmark)
router.get("/wishlist", authMiddleware, touchDeviceSession, ctrl.listWishlist)
router.post("/wishlist", authMiddleware, touchDeviceSession, ctrl.createWishlist)
router.delete("/wishlist/:id", authMiddleware, touchDeviceSession, ctrl.deleteWishlist)

export default router
