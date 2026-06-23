import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  listPublishedTestimonials,
  listAdminTestimonials,
  getAdminTestimonial,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
} from "../services/testimonial.service"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"
import { parsePagination } from "../lib/pagination"

const testimonialType = z.enum(["VIDEO", "SCREENSHOT", "TRUSTPILOT", "TEXT"])

export async function getTestimonials(req: Request, res: Response, next: NextFunction) {
  try {
    const type = req.query.type as "VIDEO" | "SCREENSHOT" | "TRUSTPILOT" | "TEXT" | undefined
    const testimonials = await listPublishedTestimonials(type)
    return sendSuccess(res, testimonials)
  } catch (err) {
    next(err)
  }
}

export async function getAdminTestimonials(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const result = await listAdminTestimonials(pagination)
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function getAdminTestimonialDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const testimonial = await getAdminTestimonial(param(req.params.testimonialId))
    return sendSuccess(res, testimonial)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
    next(err)
  }
}

export async function postTestimonial(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      type: testimonialType,
      title: z.string().optional(),
      content: z.string().optional(),
      mediaUrl: z.string().optional(),
      authorName: z.string().min(1),
      authorPhoto: z.string().optional(),
      rating: z.number().int().min(1).max(5).optional(),
      courseName: z.string().optional(),
      sortOrder: z.number().int().optional(),
      isPublished: z.boolean().optional(),
    })
    const data = schema.parse(req.body)
    const testimonial = await createTestimonial(data)
    return sendSuccess(res, testimonial, 201)
  } catch (err) {
    next(err)
  }
}

export async function patchTestimonial(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      type: testimonialType.optional(),
      title: z.string().nullable().optional(),
      content: z.string().nullable().optional(),
      mediaUrl: z.string().nullable().optional(),
      authorName: z.string().min(1).optional(),
      authorPhoto: z.string().nullable().optional(),
      rating: z.number().int().min(1).max(5).nullable().optional(),
      courseName: z.string().nullable().optional(),
      sortOrder: z.number().int().optional(),
      isPublished: z.boolean().optional(),
    })
    const data = schema.parse(req.body)
    const testimonial = await updateTestimonial(param(req.params.testimonialId), data)
    return sendSuccess(res, testimonial)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
    next(err)
  }
}

export async function removeTestimonial(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteTestimonial(param(req.params.testimonialId))
    return sendSuccess(res, result)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
    next(err)
  }
}
