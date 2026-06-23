import { Router } from "express"
import * as siteCmsController from "../controllers/site-cms.controller"

const router = Router()

router.get("/settings", siteCmsController.getSiteSettings)
router.get("/pages/:slug", siteCmsController.getSitePage)
router.get("/homepage", siteCmsController.getSiteHomepage)

export default router
