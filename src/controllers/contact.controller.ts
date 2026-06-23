import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  submitContactInquiry,
  listAdminInquiries,
  getAdminInquiry,
  updateInquiryStatus,
} from "../services/contact.service"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"
import { parsePagination } from "../lib/pagination"

const inquirySubject = z.enum([
  "GENERAL",
  "COURSE",
  "PAYMENT",
  "CONSULTATION",
  "TECHNICAL",
  "PARTNERSHIP",
])

const inquiryStatus = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"])

const submitSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional(),
  subject: inquirySubject,
  message: z.string().trim().min(10).max(2000),
  website: z.string().optional(),
})

export async function postContact(req: Request, res: Response, next: NextFunction) {
  try {
    const data = submitSchema.parse(req.body)

    if (data.website?.trim()) {
      return sendSuccess(res, {
        id: "ok",
        message: "Your message has been received. We typically reply within 24–48 hours.",
      })
    }

    const result = await submitContactInquiry({
      name: data.name,
      email: data.email,
      phone: data.phone,
      subject: data.subject,
      message: data.message,
      userId: req.user?.userId,
    })

    return sendSuccess(res, result, 201)
  } catch (err) {
    next(err)
  }
}

export async function getAdminInquiries(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const status = req.query.status as z.infer<typeof inquiryStatus> | undefined
    const subject = req.query.subject as z.infer<typeof inquirySubject> | undefined
    const search = typeof req.query.search === "string" ? req.query.search : undefined

    const result = await listAdminInquiries(pagination, {
      status: status && inquiryStatus.safeParse(status).success ? status : undefined,
      subject: subject && inquirySubject.safeParse(subject).success ? subject : undefined,
      search,
    })

    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function getAdminInquiryDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const inquiry = await getAdminInquiry(param(req.params.inquiryId))
    return sendSuccess(res, inquiry)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
    next(err)
  }
}

export async function patchAdminInquiry(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({ status: inquiryStatus })
    const { status } = schema.parse(req.body)
    const inquiry = await updateInquiryStatus(param(req.params.inquiryId), status)
    return sendSuccess(res, inquiry)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
    next(err)
  }
}
