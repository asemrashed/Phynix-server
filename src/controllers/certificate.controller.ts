import { Request, Response, NextFunction } from "express"
import {
  getStudentCertificates,
  verifyCertificate,
  canDownloadCertificate,
} from "../services/certificate.service"
import { generateCertificateQrPng, getCertificateFilePath } from "../services/pdf.service"
import { isAllowedPublicOrigin } from "../lib/site-url"
import { sendSuccess, sendError } from "../lib/response"
import { prisma } from "../lib/prisma"
import { param } from "../lib/params"

export async function getCertificates(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }

    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
    })
    if (!student) {
      return sendError(res, "NOT_FOUND", "Student not found", 404)
    }

    const certs = await getStudentCertificates(student.id)
    return sendSuccess(res, certs)
  } catch (err) {
    next(err)
  }
}

export async function download(req: Request, res: Response, next: NextFunction) {
  try {
    const certCode = param(req.params.certCode)

    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Login required to download certificate", 401)
    }

    const allowed = await canDownloadCertificate(
      certCode,
      req.user.userId,
      req.user.role
    )
    if (!allowed) {
      return sendError(res, "FORBIDDEN", "You do not have access to this certificate", 403)
    }

    const filepath = getCertificateFilePath(certCode)
    if (!filepath) {
      return sendError(res, "NOT_FOUND", "Certificate PDF not generated yet", 404)
    }

    return res.download(filepath, `${certCode}.pdf`)
  } catch (err) {
    next(err)
  }
}

export async function qrCode(req: Request, res: Response, next: NextFunction) {
  try {
    const certCode = param(req.params.certCode)
    const cert = await prisma.certificate.findUnique({ where: { certCode } })
    if (!cert) {
      return sendError(res, "NOT_FOUND", "Certificate not found", 404)
    }

    const originParam = typeof req.query.origin === "string" ? req.query.origin : undefined
    const baseUrl =
      originParam && isAllowedPublicOrigin(originParam) ? originParam : undefined

    const png = await generateCertificateQrPng(certCode, baseUrl)
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin")
    res.setHeader("Content-Type", "image/png")
    res.setHeader("Cache-Control", "public, max-age=3600")
    return res.send(png)
  } catch (err) {
    next(err)
  }
}

export async function verify(req: Request, res: Response, next: NextFunction) {
  try {
    const certCode = param(req.params.certCode)
    const result = await verifyCertificate(certCode)
    if (!result) {
      return sendError(res, "NOT_FOUND", "Certificate not found", 404)
    }
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}
