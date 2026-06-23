import { Request, Response, NextFunction } from "express"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"
import {
  updateConsultationTypeSchema,
  updateHomepageSectionSchema,
  updateSiteFooterSchema,
  updateSitePageSchema,
  updateSiteSettingsSchema,
} from "@fxprime/types"
import {
  getAdminHomepageSection,
  getAdminSitePage,
  getAdminSiteSettings,
  getPublicConsultationTypes,
  getPublicHomepage,
  getPublicSitePage,
  getPublicSiteSettings,
  listAdminConsultationTypes,
  listAdminHomepageSections,
  listAdminSitePages,
  updateAdminConsultationType,
  updateAdminHomepageSection,
  updateAdminSitePage,
  updateAdminSiteSettings,
  updateAdminSiteFooter,
} from "../services/site-cms.service"

function handleSiteCmsError(err: unknown, res: Response, next: NextFunction) {
  const code = (err as { code?: string }).code
  if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
  if (code === "FORBIDDEN") return sendError(res, code, (err as Error).message, 403)
  next(err)
}

export async function getSiteSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await getPublicSiteSettings()
    return sendSuccess(res, settings)
  } catch (err) {
    next(err)
  }
}

export async function getSitePage(req: Request, res: Response, next: NextFunction) {
  try {
    const page = await getPublicSitePage(param(req.params.slug))
    if (!page) return sendError(res, "NOT_FOUND", "Page not found", 404)
    return sendSuccess(res, page)
  } catch (err) {
    next(err)
  }
}

export async function getSiteHomepage(_req: Request, res: Response, next: NextFunction) {
  try {
    const homepage = await getPublicHomepage()
    return sendSuccess(res, homepage)
  } catch (err) {
    next(err)
  }
}

export async function getSiteConsultationTypes(_req: Request, res: Response, next: NextFunction) {
  try {
    const types = await getPublicConsultationTypes()
    return sendSuccess(res, types)
  } catch (err) {
    next(err)
  }
}

export async function getAdminSiteSettingsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await getAdminSiteSettings()
    return sendSuccess(res, settings)
  } catch (err) {
    next(err)
  }
}

export async function patchAdminSiteSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateSiteSettingsSchema.parse(req.body)
    const settings = await updateAdminSiteSettings(data)
    return sendSuccess(res, settings)
  } catch (err) {
    next(err)
  }
}

export async function patchAdminSiteFooter(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateSiteFooterSchema.parse(req.body)
    const settings = await updateAdminSiteFooter(data)
    return sendSuccess(res, settings)
  } catch (err) {
    next(err)
  }
}

export async function getAdminSitePages(_req: Request, res: Response, next: NextFunction) {
  try {
    const pages = await listAdminSitePages()
    return sendSuccess(res, pages)
  } catch (err) {
    next(err)
  }
}

export async function getAdminSitePageDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const page = await getAdminSitePage(param(req.params.slug))
    return sendSuccess(res, page)
  } catch (err) {
    handleSiteCmsError(err, res, next)
  }
}

export async function patchAdminSitePage(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateSitePageSchema.parse(req.body)
    const page = await updateAdminSitePage(param(req.params.slug), data)
    return sendSuccess(res, page)
  } catch (err) {
    handleSiteCmsError(err, res, next)
  }
}

export async function getAdminHomepageSections(_req: Request, res: Response, next: NextFunction) {
  try {
    const sections = await listAdminHomepageSections()
    return sendSuccess(res, sections)
  } catch (err) {
    next(err)
  }
}

export async function getAdminHomepageSectionDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const section = await getAdminHomepageSection(param(req.params.key))
    return sendSuccess(res, section)
  } catch (err) {
    handleSiteCmsError(err, res, next)
  }
}

export async function patchAdminHomepageSection(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateHomepageSectionSchema.parse(req.body)
    const section = await updateAdminHomepageSection(param(req.params.key), data)
    return sendSuccess(res, section)
  } catch (err) {
    handleSiteCmsError(err, res, next)
  }
}

export async function getAdminConsultationTypes(_req: Request, res: Response, next: NextFunction) {
  try {
    const types = await listAdminConsultationTypes()
    return sendSuccess(res, types)
  } catch (err) {
    next(err)
  }
}

export async function patchAdminConsultationType(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateConsultationTypeSchema.parse(req.body)
    const item = await updateAdminConsultationType(param(req.params.slug), data)
    return sendSuccess(res, item)
  } catch (err) {
    handleSiteCmsError(err, res, next)
  }
}
