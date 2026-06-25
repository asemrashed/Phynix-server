import type { InquiryStatus, InquirySubject } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { paginatedResult, type PaginationParams } from "../lib/pagination"
import {
  sendContactInquiryNotificationEmail,
  sendContactInquiryAutoReplyEmail,
} from "./email.service"

const SUBJECT_LABELS: Record<InquirySubject, string> = {
  GENERAL: "General inquiry",
  COURSE: "Course & enrollment",
  PAYMENT: "Payment / refund",
  CONSULTATION: "Consultation booking",
  TECHNICAL: "Technical / account",
  PARTNERSHIP: "Partnership / media",
}

function mapInquiry(inquiry: {
  id: string
  name: string
  email: string
  phone: string | null
  subject: InquirySubject
  message: string
  status: InquiryStatus
  userId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: inquiry.id,
    name: inquiry.name,
    email: inquiry.email,
    phone: inquiry.phone,
    subject: inquiry.subject,
    subjectLabel: SUBJECT_LABELS[inquiry.subject],
    message: inquiry.message,
    status: inquiry.status,
    userId: inquiry.userId,
    createdAt: inquiry.createdAt.toISOString(),
    updatedAt: inquiry.updatedAt.toISOString(),
  }
}

export interface SubmitContactInput {
  name: string
  email: string
  phone?: string
  subject: InquirySubject
  message: string
  userId?: string
}

export async function submitContactInquiry(input: SubmitContactInput) {
  const inquiry = await prisma.contactInquiry.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      subject: input.subject,
      message: input.message,
      userId: input.userId,
    },
  })

  const mapped = mapInquiry(inquiry)
  const supportEmail =
    process.env.CONTACT_SUPPORT_EMAIL || "support@phynixeducation.com"

  await Promise.all([
    sendContactInquiryNotificationEmail({
      to: supportEmail,
      inquiry: mapped,
    }),
    sendContactInquiryAutoReplyEmail({
      to: mapped.email,
      name: mapped.name,
      subjectLabel: mapped.subjectLabel,
    }),
  ])

  return {
    id: mapped.id,
    message: "Your message has been received. We typically reply within 24–48 hours.",
  }
}

export async function listAdminInquiries(
  pagination: PaginationParams,
  filters?: { status?: InquiryStatus; subject?: InquirySubject; search?: string }
) {
  const { page, pageSize, skip } = pagination
  const where = {
    ...(filters?.status ? { status: filters.status } : {}),
    ...(filters?.subject ? { subject: filters.subject } : {}),
    ...(filters?.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" as const } },
            { email: { contains: filters.search, mode: "insensitive" as const } },
            { message: { contains: filters.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.contactInquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.contactInquiry.count({ where }),
  ])

  return paginatedResult(items.map(mapInquiry), total, page, pageSize)
}

export async function getAdminInquiry(id: string) {
  const inquiry = await prisma.contactInquiry.findUnique({ where: { id } })
  if (!inquiry) {
    const err = new Error("Inquiry not found") as Error & { code?: string }
    err.code = "NOT_FOUND"
    throw err
  }
  return mapInquiry(inquiry)
}

export async function updateInquiryStatus(id: string, status: InquiryStatus) {
  try {
    const inquiry = await prisma.contactInquiry.update({
      where: { id },
      data: { status },
    })
    return mapInquiry(inquiry)
  } catch {
    const err = new Error("Inquiry not found") as Error & { code?: string }
    err.code = "NOT_FOUND"
    throw err
  }
}
