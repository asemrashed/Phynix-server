import type { AdminCourseItem, AdminUserItem, Role } from "@fxprime/types"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { paginatedResult, type PaginationParams } from "../lib/pagination"

export type AdminUserListFilters = {
  search?: string
  role?: Role
  status?: "active" | "banned"
}

export async function listUsers(
  pagination: PaginationParams,
  filters?: AdminUserListFilters
) {
  const { page, pageSize, skip } = pagination
  const where: Prisma.UserWhereInput = {}

  if (filters?.role) {
    where.role = filters.role
  }

  if (filters?.status === "active") {
    where.isActive = true
  } else if (filters?.status === "banned") {
    where.isActive = false
  }

  if (filters?.search) {
    const q = filters.search
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { student: { firstName: { contains: q, mode: "insensitive" } } },
      { student: { lastName: { contains: q, mode: "insensitive" } } },
      { student: { uniqueStudentId: { contains: q, mode: "insensitive" } } },
    ]
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { student: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ])

  const items: AdminUserItem[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    isVerified: u.isVerified,
    createdAt: u.createdAt.toISOString(),
    studentName: u.student ? `${u.student.firstName} ${u.student.lastName}` : null,
    uniqueStudentId: u.student?.uniqueStudentId ?? null,
  }))

  return paginatedResult(items, total, page, pageSize)
}

export async function updateUser(
  userId: string,
  data: { isActive?: boolean; role?: string }
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      isActive: data.isActive,
      role: data.role as "STUDENT" | "ADMIN" | "INSTRUCTOR" | undefined,
    },
    include: { student: true },
  })
}

export async function listAdminCourses(
  pagination: PaginationParams,
  filters?: { search?: string; status?: "PUBLISHED" | "DRAFT" | "ARCHIVED" }
) {
  const { page, pageSize, skip } = pagination
  const where: Prisma.CourseWhereInput = {}

  if (filters?.status) {
    where.status = filters.status
  }

  if (filters?.search) {
    const q = filters.search
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ]
  }

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: { _count: { select: { enrollments: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.course.count({ where }),
  ])

  const items: AdminCourseItem[] = courses.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    thumbnailUrl: c.thumbnailUrl,
    price: Number(c.price),
    currency: c.currency,
    status: c.status,
    level: c.level,
    language: c.language,
    enrollmentCount: c._count.enrollments,
    isFeatured: c.isFeatured,
    createdAt: c.createdAt.toISOString(),
  }))

  return paginatedResult(items, total, page, pageSize)
}

export async function updateCourseStatus(
  courseId: string,
  data: { status?: string; isFeatured?: boolean }
) {
  return prisma.course.update({
    where: { id: courseId },
    data: {
      status: data.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined,
      isFeatured: data.isFeatured,
      publishedAt: data.status === "PUBLISHED" ? new Date() : undefined,
    },
  })
}
