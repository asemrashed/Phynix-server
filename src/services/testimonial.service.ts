import { prisma } from "../lib/prisma"
import type { TestimonialType } from "@prisma/client"
import { paginatedResult, type PaginationParams } from "../lib/pagination"

function mapTestimonial(t: {
  id: string
  type: TestimonialType
  title: string | null
  content: string | null
  mediaUrl: string | null
  authorName: string
  authorPhoto: string | null
  rating: number | null
  courseName: string | null
  sortOrder: number
  isPublished: boolean
  createdAt: Date
}) {
  return {
    id: t.id,
    type: t.type,
    title: t.title,
    content: t.content,
    mediaUrl: t.mediaUrl,
    authorName: t.authorName,
    authorPhoto: t.authorPhoto,
    rating: t.rating,
    courseName: t.courseName,
    sortOrder: t.sortOrder,
    isPublished: t.isPublished,
    createdAt: t.createdAt.toISOString(),
  }
}

export async function listPublishedTestimonials(type?: TestimonialType) {
  const testimonials = await prisma.testimonial.findMany({
    where: {
      isPublished: true,
      ...(type ? { type } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  })
  return testimonials.map(mapTestimonial)
}

export async function listAdminTestimonials(pagination: PaginationParams) {
  const { page, pageSize, skip } = pagination

  const [testimonials, total] = await Promise.all([
    prisma.testimonial.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.testimonial.count(),
  ])

  return paginatedResult(testimonials.map(mapTestimonial), total, page, pageSize)
}

export async function getAdminTestimonial(id: string) {
  const t = await prisma.testimonial.findUnique({ where: { id } })
  if (!t) throw Object.assign(new Error("Testimonial not found"), { code: "NOT_FOUND" })
  return mapTestimonial(t)
}

export async function createTestimonial(data: {
  type: TestimonialType
  title?: string
  content?: string
  mediaUrl?: string
  authorName: string
  authorPhoto?: string
  rating?: number
  courseName?: string
  sortOrder?: number
  isPublished?: boolean
}) {
  const t = await prisma.testimonial.create({ data })
  return mapTestimonial(t)
}

export async function updateTestimonial(
  id: string,
  data: {
    type?: TestimonialType
    title?: string | null
    content?: string | null
    mediaUrl?: string | null
    authorName?: string
    authorPhoto?: string | null
    rating?: number | null
    courseName?: string | null
    sortOrder?: number
    isPublished?: boolean
  }
) {
  const existing = await prisma.testimonial.findUnique({ where: { id } })
  if (!existing) throw Object.assign(new Error("Testimonial not found"), { code: "NOT_FOUND" })
  const t = await prisma.testimonial.update({ where: { id }, data })
  return mapTestimonial(t)
}

export async function deleteTestimonial(id: string) {
  const existing = await prisma.testimonial.findUnique({ where: { id } })
  if (!existing) throw Object.assign(new Error("Testimonial not found"), { code: "NOT_FOUND" })
  await prisma.testimonial.delete({ where: { id } })
  return { deleted: true }
}
