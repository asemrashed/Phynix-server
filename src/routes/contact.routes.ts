import { Router } from "express"
import * as contactController from "../controllers/contact.controller"
import { optionalAuth } from "../middlewares/auth.middleware"

const router = Router()

router.post("/", optionalAuth, contactController.postContact)

export default router
