import { Router } from "express"
import * as ctrl from "../controllers/review.controller"

const router = Router()

router.get("/", ctrl.getRecentReviews)

export default router
