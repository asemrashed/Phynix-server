import { Router } from "express"
import * as ctrl from "../controllers/testimonial.controller"

const router = Router()

router.get("/", ctrl.getTestimonials)

export default router
