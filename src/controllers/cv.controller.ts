import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import { sendSuccess, sendError } from "../lib/response"
import { prisma } from "../lib/prisma"
import { getStudentCv, saveStudentCv, buildStudentCvPdf } from "../services/cv.service"

const cvDraftSchema = z.object({
  headline: z.string().max(120).optional(),
  summary: z.string().max(2000).optional(),
  skills: z.array(z.string().max(80)).max(30).optional(),
  experience: z
    .array(
      z.object({
        title: z.string().max(120),
        organization: z.string().max(120),
        year: z.string().max(40),
        description: z.string().max(500).optional(),
      })
    )
    .max(20)
    .optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(30).optional(),
  includeCertificates: z.boolean().optional(),
  includeCompletedCourses: z.boolean().optional(),
})

export async function getMyCv(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)

    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
      include: { user: { select: { email: true } } },
    })
    if (!student) return sendError(res, "NOT_FOUND", "Student not found", 404)

    const data = await getStudentCv(student.id, student.user.email)
    return sendSuccess(res, data)
  } catch (err) {
    next(err)
  }
}

export async function patchMyCv(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)

    const body = cvDraftSchema.parse(req.body)
    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
      include: { user: { select: { email: true } } },
    })
    if (!student) return sendError(res, "NOT_FOUND", "Student not found", 404)

    const current = await getStudentCv(student.id, student.user.email)
    const draft = {
      ...current.draft,
      ...body,
      skills: body.skills ?? current.draft.skills,
      experience: body.experience ?? current.draft.experience,
    }

    const saved = await saveStudentCv(student.id, draft)
    return sendSuccess(res, { draft: saved })
  } catch (err) {
    next(err)
  }
}

export async function downloadMyCvPdf(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)

    const body = req.body && Object.keys(req.body).length > 0 ? cvDraftSchema.parse(req.body) : undefined

    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
      include: { user: { select: { email: true } } },
    })
    if (!student) return sendError(res, "NOT_FOUND", "Student not found", 404)

    const current = await getStudentCv(student.id, student.user.email)
    const draft = body
      ? {
          ...current.draft,
          ...body,
          skills: body.skills ?? current.draft.skills,
          experience: body.experience ?? current.draft.experience,
        }
      : undefined

    const pdfBuffer = await buildStudentCvPdf(student.id, student.user.email, draft)
    const filename = `FXPrime-CV-${student.firstName}-${student.lastName}.pdf`.replace(/\s+/g, "-")

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    return res.send(pdfBuffer)
  } catch (err) {
    next(err)
  }
}
