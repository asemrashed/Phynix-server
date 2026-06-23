import type { CertificateItem, CertificateVerification } from "@fxprime/types"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { generateCertCode } from "./student-id.service"
import { createNotification } from "./notification.service"
import { generateCertificatePdf, getCertificateFilePath } from "./pdf.service"
import {
  sendCertificateEmail,
  sendCertificateFailedEmail,
} from "./email.service"
import { countCompletedLessonsForEnrollment } from "../lib/course-completion"
import fs from "fs"

type CertificateWithCourse = Prisma.CertificateGetPayload<{ include: { course: true } }>

async function markEnrollmentCertificateStatus(
  studentId: string,
  courseId: string,
  status: "ISSUED" | "FAILED" | "PENDING",
  error?: string
) {
  await prisma.enrollment.updateMany({
    where: { studentId, courseId },
    data: {
      certificateStatus: status,
      certificateError: error ?? null,
    },
  })
}

export async function generateCertificate(
  studentId: string,
  courseId: string,
  userId: string
) {
  const existing = await prisma.certificate.findFirst({
    where: { studentId, courseId, isRevoked: false },
  })
  if (existing) {
    await markEnrollmentCertificateStatus(studentId, courseId, "ISSUED")
    return existing
  }

  const [student, course, enrollment] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    }),
    prisma.course.findUnique({
      where: { id: courseId },
      include: { instructor: true },
    }),
    prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
      include: {
        course: { include: { sections: { include: { lessons: { select: { id: true } } } } } },
      },
    }),
  ])

  if (!student || !course || !enrollment) {
    throw Object.assign(new Error("Student or course not found"), { code: "NOT_FOUND" })
  }

  const lessonIds = enrollment.course.sections.flatMap((s) =>
    s.lessons.map((l) => l.id)
  )
  const completed = await countCompletedLessonsForEnrollment(enrollment.id, lessonIds)
  if (lessonIds.length === 0 || completed < lessonIds.length) {
    throw Object.assign(new Error("Course not fully completed"), { code: "NOT_COMPLETE" })
  }

  const certCode = await generateCertCode()

  const pdfUrl = await generateCertificatePdf({
    certCode,
    studentName: `${student.firstName} ${student.lastName}`,
    studentId: student.uniqueStudentId || "N/A",
    courseTitle: course.title,
    issuedAt: new Date(),
    instructorName: course.instructor.displayName,
  })

  const certificate = await prisma.certificate.create({
    data: {
      certCode,
      studentId,
      courseId,
      pdfUrl,
      registrationType: student.registrationType,
    },
  })

  await markEnrollmentCertificateStatus(studentId, courseId, "ISSUED")

  await createNotification(
    userId,
    "CERTIFICATE_READY",
    "Certificate Ready!",
    `Your certificate for ${course.title} is ready. Download it and share how the course helped you!`,
    `/dashboard/courses/${course.slug}?review=1`
  )

  if (student.user?.email) {
    await sendCertificateEmail(
      student.user.email,
      student.firstName,
      course.title,
      certCode,
      course.slug
    )
  }

  return certificate
}

export async function handleCertificateGenerationFailure(
  studentId: string,
  courseId: string,
  userId: string,
  error: Error
) {
  await markEnrollmentCertificateStatus(studentId, courseId, "FAILED", error.message)

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true },
  })
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  })

  await createNotification(
    userId,
    "CERTIFICATE_FAILED",
    "Certificate Generation Failed",
    `We could not generate your certificate for ${course?.title ?? "the course"}. Our team has been notified.`,
    `/dashboard/certificates`
  )

  if (student?.user?.email) {
    await sendCertificateFailedEmail(
      student.user.email,
      student.firstName,
      course?.title ?? "your course"
    )
  }
}

export async function regenerateCertificatePdf(certificateId: string) {
  const cert = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: {
      student: true,
      course: { include: { instructor: true } },
    },
  })

  if (!cert) {
    throw Object.assign(new Error("Certificate not found"), { code: "NOT_FOUND" })
  }
  if (cert.isRevoked) {
    throw Object.assign(new Error("Cannot regenerate a revoked certificate"), {
      code: "REVOKED",
    })
  }

  const existingPath = getCertificateFilePath(cert.certCode)
  if (existingPath && fs.existsSync(existingPath)) {
    fs.unlinkSync(existingPath)
  }

  const pdfUrl = await generateCertificatePdf({
    certCode: cert.certCode,
    studentName: `${cert.student.firstName} ${cert.student.lastName}`,
    studentId: cert.student.uniqueStudentId || "N/A",
    courseTitle: cert.course.title,
    issuedAt: cert.issuedAt,
    instructorName: cert.course.instructor.displayName,
  })

  return prisma.certificate.update({
    where: { id: certificateId },
    data: { pdfUrl },
    include: { student: true, course: true },
  })
}

export async function getStudentCertificates(studentId: string): Promise<CertificateItem[]> {
  const certs = await prisma.certificate.findMany({
    where: { studentId },
    include: { course: true },
    orderBy: { issuedAt: "desc" },
  })

  return certs.map((c: CertificateWithCourse) => ({
    id: c.id,
    certCode: c.certCode,
    courseTitle: c.course.title,
    pdfUrl: c.pdfUrl || "",
    issuedAt: c.issuedAt.toISOString(),
    isRevoked: c.isRevoked,
  }))
}

export async function verifyCertificate(certCode: string): Promise<CertificateVerification | null> {
  const cert = await prisma.certificate.findUnique({
    where: { certCode },
    include: { student: true, course: true },
  })

  if (!cert) return null

  return {
    valid: !cert.isRevoked,
    certCode: cert.certCode,
    studentName: `${cert.student.firstName} ${cert.student.lastName}`,
    studentId: cert.student.uniqueStudentId || "N/A",
    courseTitle: cert.course.title,
    issuedAt: cert.issuedAt.toISOString(),
    isRevoked: cert.isRevoked,
    revokedAt: cert.revokedAt?.toISOString() ?? null,
    revokedReason: cert.revokedReason,
  }
}

export async function canDownloadCertificate(
  certCode: string,
  userId: string,
  role: string
): Promise<boolean> {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return true

  const cert = await prisma.certificate.findUnique({
    where: { certCode },
    include: { student: { select: { userId: true } } },
  })
  if (!cert || cert.isRevoked) return false
  return cert.student.userId === userId
}
