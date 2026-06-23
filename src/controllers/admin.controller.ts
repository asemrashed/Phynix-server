import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import { getAdminStats } from "../services/stats.service"
import { listUsers, updateUser, listAdminCourses, updateCourseStatus } from "../services/admin.service"
import {
  listAdminBlogPosts,
  getAdminBlogPost,
  createBlogPost,
  updateBlogPost,
  listAdminDigitalProducts,
  listAdminPhysicalProducts,
  listBlogCategories,
  createBlogCategory,
  updateBlogCategory,
  deleteBlogCategory,
} from "../services/admin-content.service"
import {
  listAdminOrders,
  getAdminOrder,
  updateAdminOrder,
  deleteAdminOrder,
} from "../services/order-admin.service"
import { listAdminPayments, processRefund } from "../services/refund.service"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"
import { parsePagination, parseSearch, parseFilterParam } from "../lib/pagination"

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await getAdminStats()
    return sendSuccess(res, stats)
  } catch (err) {
    next(err)
  }
}

const USER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "INSTRUCTOR",
  "STUDENT",
] as const

export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const search = parseSearch(req.query)
    const roleParam = parseFilterParam(req.query, "role")
    const role = USER_ROLES.includes(roleParam as (typeof USER_ROLES)[number])
      ? (roleParam as (typeof USER_ROLES)[number])
      : undefined
    const statusParam = parseFilterParam(req.query, "status")
    const status =
      statusParam === "active" || statusParam === "banned" ? statusParam : undefined
    const result = await listUsers(pagination, { search, role, status })
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function patchUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = param(req.params.userId)
    const schema = z.object({
      isActive: z.boolean().optional(),
      role: z.enum(["STUDENT", "ADMIN", "INSTRUCTOR"]).optional(),
    })
    const data = schema.parse(req.body)
    const user = await updateUser(userId, data)
    return sendSuccess(res, user)
  } catch (err) {
    next(err)
  }
}

export async function getCourses(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const search = parseSearch(req.query)
    const status =
      req.query.status === "PUBLISHED" ||
      req.query.status === "DRAFT" ||
      req.query.status === "ARCHIVED"
        ? req.query.status
        : undefined
    const result = await listAdminCourses(pagination, { search, status })
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function patchCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const courseId = param(req.params.courseId)
    const schema = z.object({
      status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
      isFeatured: z.boolean().optional(),
    })
    const data = schema.parse(req.body)
    const course = await updateCourseStatus(courseId, data)
    return sendSuccess(res, course)
  } catch (err) {
    next(err)
  }
}

export async function getBlogPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const result = await listAdminBlogPosts(pagination, {
      search: parseSearch(req.query),
      status: parseFilterParam(req.query, "status"),
    })
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function getBlogCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await listBlogCategories()
    return sendSuccess(res, categories)
  } catch (err) {
    next(err)
  }
}

const blogPostSchema = z.object({
  title: z.string().min(3),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().optional(),
  content: z.string().min(10),
  categoryId: z.string().uuid(),
  coverUrl: z.string().optional(),
  isPremium: z.boolean().optional(),
  metaTitle: z.string().optional(),
  metaDesc: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  publishNow: z.boolean().optional(),
})

const blogPostPatchSchema = blogPostSchema.partial().extend({
  excerpt: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDesc: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
})

function handleBlogError(err: unknown, res: Response, next: NextFunction) {
  const code = (err as { code?: string }).code
  if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
  if (code === "SLUG_EXISTS" || code === "HAS_POSTS") {
    return sendError(res, code, (err as Error).message, 400)
  }
  return next(err)
}

export async function getBlogPostDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const post = await getAdminBlogPost(param(req.params.postId))
    return sendSuccess(res, post)
  } catch (err) {
    return handleBlogError(err, res, next)
  }
}

export async function createBlog(req: Request, res: Response, next: NextFunction) {
  try {
    const data = blogPostSchema.parse(req.body)
    const post = await createBlogPost(req.user!.userId, data)
    return sendSuccess(res, post, 201)
  } catch (err) {
    return handleBlogError(err, res, next)
  }
}

export async function patchBlogPost(req: Request, res: Response, next: NextFunction) {
  try {
    const postId = param(req.params.postId)
    const data = blogPostPatchSchema.parse(req.body)
    const post = await updateBlogPost(postId, data)
    return sendSuccess(res, post)
  } catch (err) {
    return handleBlogError(err, res, next)
  }
}

export async function postBlogCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      name: z.string().min(2),
      slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
    })
    const data = schema.parse(req.body)
    const category = await createBlogCategory(data)
    return sendSuccess(res, category, 201)
  } catch (err) {
    return handleBlogError(err, res, next)
  }
}

export async function patchBlogCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const categoryId = param(req.params.categoryId)
    const schema = z.object({
      name: z.string().min(2).optional(),
      slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
    })
    const data = schema.parse(req.body)
    const category = await updateBlogCategory(categoryId, data)
    return sendSuccess(res, category)
  } catch (err) {
    return handleBlogError(err, res, next)
  }
}

export async function removeBlogCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteBlogCategory(param(req.params.categoryId))
    return sendSuccess(res, result)
  } catch (err) {
    return handleBlogError(err, res, next)
  }
}

export async function getDigitalProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const result = await listAdminDigitalProducts(pagination)
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function getPhysicalProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const result = await listAdminPhysicalProducts(pagination)
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function getOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const result = await listAdminOrders(pagination, {
      search: parseSearch(req.query),
      status: parseFilterParam(req.query, "status"),
      from: parseFilterParam(req.query, "from"),
      to: parseFilterParam(req.query, "to"),
    })
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function getPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const result = await listAdminPayments(pagination, {
      search: parseSearch(req.query),
      status: parseFilterParam(req.query, "status"),
      from: parseFilterParam(req.query, "from"),
      to: parseFilterParam(req.query, "to"),
    })
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function refundPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const paymentId = param(req.params.paymentId)
    const schema = z.object({
      type: z.enum(["full", "partial"]),
      amount: z.number().positive().optional(),
      reason: z.string().max(500).optional(),
    })
    const data = schema.parse(req.body)

    if (data.type === "partial" && !data.amount) {
      return sendError(res, "INVALID_AMOUNT", "Partial refund requires an amount", 400)
    }

    try {
      const result = await processRefund(paymentId, data, req.user?.userId)
      return sendSuccess(res, result)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === "NOT_FOUND") {
        return sendError(res, code, (err as Error).message, 404)
      }
      if (code === "INVALID_STATE" || code === "INVALID_AMOUNT") {
        return sendError(res, code, (err as Error).message, 400)
      }
      throw err
    }
  } catch (err) {
    next(err)
  }
}

export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = param(req.params.orderId)
    const order = await getAdminOrder(orderId)
    return sendSuccess(res, order)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function patchOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = param(req.params.orderId)
    const schema = z.object({
      status: z
        .enum(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"])
        .optional(),
      trackingNumber: z.string().max(120).optional(),
      notes: z.string().max(500).optional(),
    })
    const data = schema.parse(req.body)
    const order = await updateAdminOrder(orderId, data, { adminUserId: req.user!.userId })
    return sendSuccess(res, order)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    if (error.code === "INVALID_TRANSITION" || error.code === "INVALID_INPUT") {
      return sendError(res, error.code, error.message, 400)
    }
    next(err)
  }
}

export async function removeOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = param(req.params.orderId)
    const result = await deleteAdminOrder(orderId)
    return sendSuccess(res, result)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    if (error.code === "INVALID_STATE") {
      return sendError(res, "INVALID_STATE", error.message, 400)
    }
    next(err)
  }
}

