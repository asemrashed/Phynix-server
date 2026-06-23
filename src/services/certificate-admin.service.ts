import type {
  AdminCertificateFailedItem,
  AdminCertificateItem,
  AdminCertificateListResult,
  AdminCertificateStats,
} from "@fxprime/types"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { paginatedResult, type PaginationParams } from "../lib/pagination"
import { createNotification } from "./notification.service"
import { sendCertificateRevokedEmail } from "./email.service"
import {
  generateCertificate,
  regenerateCertificatePdf,
} from "./certificate.service"
import { queueCertificateGeneration } from "../jobs/certificate.job"

type CertificateAdminRow = Prisma.CertificateGetPayload<{
  include: { student: true; course: true }
}>

function mapAdminCertificate(cert: CertificateAdminRow): AdminCertificateItem {
  return {
    id: cert.id,
    certCode: cert.certCode,
    studentName: `${cert.student.firstName} ${cert.student.lastName}`,
    studentId: cert.student.uniqueStudentId || "N/A",
    courseTitle: cert.course.title,
    courseId: cert.courseId,
    issuedAt: cert.issuedAt.toISOString(),
    isRevoked: cert.isRevoked,
    revokedAt: cert.revokedAt?.toISOString() ?? null,
    revokedReason: cert.revokedReason,
    pdfUrl: cert.pdfUrl,
  }
}

export async function getAdminCertificateStats(): Promise<AdminCertificateStats> {
  const [total, active, revoked, failed] = await Promise.all([
    prisma.certificate.count(),
    prisma.certificate.count({ where: { isRevoked: false } }),
    prisma.certificate.count({ where: { isRevoked: true } }),
    prisma.enrollment.count({ where: { certificateStatus: "FAILED" } }),
  ])
  return { total, active, revoked, failed }
}

export async function listAdminCertificates(filters?: {
  search?: string
  status?: "all" | "active" | "revoked"
  page?: number
  pageSize?: number
}): Promise<AdminCertificateListResult> {
  const page = Math.max(1, filters?.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 20))
  const where: Prisma.CertificateWhereInput = {}

  if (filters?.status === "active") {
    where.isRevoked = false
  } else if (filters?.status === "revoked") {
    where.isRevoked = true
  }

  if (filters?.search?.trim()) {
    const q = filters.search.trim()
    where.OR = [
      { certCode: { contains: q, mode: "insensitive" } },
      { course: { title: { contains: q, mode: "insensitive" } } },
      { student: { firstName: { contains: q, mode: "insensitive" } } },
      { student: { lastName: { contains: q, mode: "insensitive" } } },
      { student: { uniqueStudentId: { contains: q, mode: "insensitive" } } },
    ]
  }

  const [certs, total, stats] = await Promise.all([
    prisma.certificate.findMany({
      where,
      include: { student: true, course: true },
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.certificate.count({ where }),
    getAdminCertificateStats(),
  ])

  return {
    items: certs.map(mapAdminCertificate),
    total,
    page,
    pageSize,
    stats,
  }
}

export async function listFailedCertificateEnrollments(
  pagination: PaginationParams
) {
  const { page, pageSize, skip } = pagination
  const where = { certificateStatus: "FAILED" as const }

  const [enrollments, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      include: {
        student: true,
        course: { select: { id: true, title: true } },
      },
      orderBy: { completedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.enrollment.count({ where }),
  ])

  const items: AdminCertificateFailedItem[] = enrollments.map((e) => ({
    enrollmentId: e.id,
    studentId: e.studentId,
    studentName: `${e.student.firstName} ${e.student.lastName}`,
    uniqueStudentId: e.student.uniqueStudentId || "N/A",
    courseId: e.courseId,
    courseTitle: e.course.title,
    progress: e.progress,
    certificateError: e.certificateError,
    completedAt: e.completedAt?.toISOString() ?? null,
  }))

  return paginatedResult(items, total, page, pageSize)
}

export async function exportAdminCertificatesCsv(filters?: {
  search?: string
  status?: "all" | "active" | "revoked"
}): Promise<string> {
  const where: Prisma.CertificateWhereInput = {}
  if (filters?.status === "active") where.isRevoked = false
  else if (filters?.status === "revoked") where.isRevoked = true

  if (filters?.search?.trim()) {
    const q = filters.search.trim()
    where.OR = [
      { certCode: { contains: q, mode: "insensitive" } },
      { course: { title: { contains: q, mode: "insensitive" } } },
      { student: { firstName: { contains: q, mode: "insensitive" } } },
      { student: { lastName: { contains: q, mode: "insensitive" } } },
      { student: { uniqueStudentId: { contains: q, mode: "insensitive" } } },
    ]
  }

  const certs = await prisma.certificate.findMany({
    where,
    include: { student: true, course: true },
    orderBy: { issuedAt: "desc" },
    take: 5000,
  })

  const header =
    "certCode,studentName,studentId,courseTitle,issuedAt,status,revokedReason"
  const rows = certs.map((c) => {
    const cols = [
      c.certCode,
      `${c.student.firstName} ${c.student.lastName}`,
      c.student.uniqueStudentId || "N/A",
      c.course.title,
      c.issuedAt.toISOString(),
      c.isRevoked ? "revoked" : "active",
      c.revokedReason ?? "",
    ]
    return cols.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
  })

  return [header, ...rows].join("\n")
}

export async function issueCertificateManually(studentId: string, courseId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    include: { student: { select: { userId: true } } },
  })

  if (!enrollment) {
    throw Object.assign(new Error("Enrollment not found"), { code: "NOT_FOUND" })
  }
  if (enrollment.progress < 100) {
    throw Object.assign(new Error("Student has not completed the course"), {
      code: "NOT_COMPLETE",
    })
  }

  const cert = await generateCertificate(studentId, courseId, enrollment.student.userId)
  const full = await prisma.certificate.findUnique({
    where: { id: cert.id },
    include: { student: true, course: true },
  })
  if (!full) {
    throw Object.assign(new Error("Certificate not found"), { code: "NOT_FOUND" })
  }
  return mapAdminCertificate(full)
}

export async function retryFailedCertificate(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { student: { select: { userId: true } } },
  })

  if (!enrollment) {
    throw Object.assign(new Error("Enrollment not found"), { code: "NOT_FOUND" })
  }
  if (enrollment.certificateStatus !== "FAILED") {
    throw Object.assign(new Error("Enrollment is not in failed state"), {
      code: "INVALID_STATE",
    })
  }
  if (enrollment.progress < 100) {
    throw Object.assign(new Error("Course not complete"), { code: "NOT_COMPLETE" })
  }

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { certificateStatus: "PENDING", certificateError: null },
  })

  await queueCertificateGeneration(
    enrollment.studentId,
    enrollment.courseId,
    enrollment.student.userId
  )

  return { success: true, enrollmentId }
}

export async function regenerateAdminCertificate(certificateId: string) {
  const updated = await regenerateCertificatePdf(certificateId)
  return mapAdminCertificate(updated)
}

export async function revokeCertificate(
  certificateId: string,
  reason: string
): Promise<AdminCertificateItem> {
  const cert = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: { student: { include: { user: true } }, course: true },
  })

  if (!cert) {
    throw Object.assign(new Error("Certificate not found"), { code: "NOT_FOUND" })
  }

  if (cert.isRevoked) {
    throw Object.assign(new Error("Certificate already revoked"), { code: "ALREADY_REVOKED" })
  }

  const updated = await prisma.certificate.update({
    where: { id: certificateId },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: reason.trim() || "Revoked by administrator",
    },
    include: { student: { include: { user: true } }, course: true },
  })

  if (updated.student.userId) {
    await createNotification(
      updated.student.userId,
      "CERTIFICATE_REVOKED",
      "Certificate Revoked",
      `Your certificate for ${updated.course.title} has been revoked.`,
      `/dashboard/certificates`
    )
  }

  if (updated.student.user?.email) {
    await sendCertificateRevokedEmail(
      updated.student.user.email,
      updated.student.firstName,
      updated.course.title,
      reason.trim() || "Revoked by administrator"
    )
  }

  return mapAdminCertificate(updated)
}
