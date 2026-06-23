import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"
import { parsePagination } from "../lib/pagination"
import {
  listAdminCertificates,
  listFailedCertificateEnrollments,
  exportAdminCertificatesCsv,
  issueCertificateManually,
  retryFailedCertificate,
  regenerateAdminCertificate,
  revokeCertificate,
  getAdminCertificateStats,
} from "../services/certificate-admin.service"

const revokeSchema = z.object({
  reason: z.string().min(3).max(500),
})

const issueSchema = z.object({
  studentId: z.string().uuid(),
  courseId: z.string().uuid(),
})

const retrySchema = z.object({
  enrollmentId: z.string().uuid(),
})

export async function getCertificates(req: Request, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined
    const status =
      req.query.status === "active" || req.query.status === "revoked"
        ? req.query.status
        : "all"
    const page = req.query.page ? Number(req.query.page) : 1
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20

    const result = await listAdminCertificates({ search, status, page, pageSize })
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await getAdminCertificateStats()
    return sendSuccess(res, stats)
  } catch (err) {
    next(err)
  }
}

export async function getFailed(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const result = await listFailedCertificateEnrollments(pagination)
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function exportCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined
    const status =
      req.query.status === "active" || req.query.status === "revoked"
        ? req.query.status
        : "all"
    const csv = await exportAdminCertificatesCsv({ search, status })
    res.setHeader("Content-Type", "text/csv")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="certificates-${Date.now()}.csv"`
    )
    return res.send(csv)
  } catch (err) {
    next(err)
  }
}

export async function issue(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = issueSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, "VALIDATION_ERROR", "studentId and courseId required", 400)
    }
    const cert = await issueCertificateManually(
      parsed.data.studentId,
      parsed.data.courseId
    )
    return sendSuccess(res, cert, 201)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    if (error.code === "NOT_COMPLETE") {
      return sendError(res, "NOT_COMPLETE", error.message, 400)
    }
    next(err)
  }
}

export async function retry(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = retrySchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, "VALIDATION_ERROR", "enrollmentId required", 400)
    }
    const result = await retryFailedCertificate(parsed.data.enrollmentId)
    return sendSuccess(res, result)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    if (error.code === "INVALID_STATE" || error.code === "NOT_COMPLETE") {
      return sendError(res, error.code, error.message, 400)
    }
    next(err)
  }
}

export async function regenerate(req: Request, res: Response, next: NextFunction) {
  try {
    const certificateId = param(req.params.certificateId)
    const cert = await regenerateAdminCertificate(certificateId)
    return sendSuccess(res, cert)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    if (error.code === "REVOKED") {
      return sendError(res, "REVOKED", error.message, 409)
    }
    next(err)
  }
}

export async function revoke(req: Request, res: Response, next: NextFunction) {
  try {
    const certificateId = param(req.params.certificateId)
    const parsed = revokeSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, "VALIDATION_ERROR", "Revocation reason is required", 400)
    }

    const cert = await revokeCertificate(certificateId, parsed.data.reason)
    return sendSuccess(res, cert)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    if (error.code === "ALREADY_REVOKED") {
      return sendError(res, "ALREADY_REVOKED", error.message, 409)
    }
    next(err)
  }
}
