import { Router } from "express"
import * as ctrl from "../controllers/blog.controller"
import { optionalAuth } from "../middlewares/auth.middleware"

const router = Router()

router.get("/", ctrl.getPosts)
router.get("/categories", ctrl.getCategories)
router.get("/:slug", optionalAuth, ctrl.getPost)

export default router
