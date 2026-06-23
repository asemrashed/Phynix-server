import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import { paymentGatewaySchema } from "../lib/payment-gateways"
import {
  listDigitalProducts,
  listMarketplace,
  getDigitalProductBySlug,
  getPhysicalProductBySlug,
  getPhysicalProductById,
  purchaseDigitalProduct,
  getDigitalDownload,
  getStudentPurchases,
  listPhysicalProducts,
  getStudentOrders,
} from "../services/product.service"
import {
  getStudentOrder,
  cancelStudentOrder,
  updateStudentOrderAddress,
} from "../services/order.service"
import { createPayment } from "../services/payment-checkout.service"
import { isAnyPaymentGatewayAvailable } from "../services/payment-gateway.service"
import { sendSuccess, sendError } from "../lib/response"
import { prisma } from "../lib/prisma"
import { getStudentId } from "../lib/student"
import { param } from "../lib/params"

export async function getMarketplace(req: Request, res: Response, next: NextFunction) {
  try {
    let studentId: string | undefined
    if (req.user) {
      studentId = (await getStudentId(req.user.userId)) ?? undefined
    }

    const filters = {
      type: req.query.type as "all" | "digital" | "physical" | undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      free: req.query.free === "true" ? true : undefined,
      sort: req.query.sort as "newest" | "price_asc" | "price_desc" | undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    }

    const catalog = await listMarketplace(filters, studentId)
    return sendSuccess(res, catalog)
  } catch (err) {
    next(err)
  }
}

export async function getDigitalProductDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = param(req.params.slug)
    let studentId: string | undefined
    if (req.user) {
      studentId = (await getStudentId(req.user.userId)) ?? undefined
    }
    const product = await getDigitalProductBySlug(slug, studentId)
    if (!product) {
      return sendError(res, "NOT_FOUND", "Product not found", 404)
    }
    return sendSuccess(res, product)
  } catch (err) {
    next(err)
  }
}

export async function getPhysicalProductDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = param(req.params.slug)
    const product = await getPhysicalProductBySlug(slug)
    if (!product) {
      return sendError(res, "NOT_FOUND", "Product not found", 404)
    }
    return sendSuccess(res, product)
  } catch (err) {
    next(err)
  }
}

export async function getPhysicalProductByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = param(req.params.productId)
    const product = await getPhysicalProductById(productId)
    if (!product) {
      return sendError(res, "NOT_FOUND", "Product not found", 404)
    }
    return sendSuccess(res, product)
  } catch (err) {
    next(err)
  }
}

export async function getDigitalProducts(req: Request, res: Response, next: NextFunction) {
  try {
    let studentId: string | undefined
    if (req.user) {
      studentId = (await getStudentId(req.user.userId)) ?? undefined
    }
    const products = await listDigitalProducts(studentId)
    return sendSuccess(res, products)
  } catch (err) {
    next(err)
  }
}

const purchaseSchema = z.object({
  paymentRef: z.string().optional(),
})

export async function purchaseProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const productId = param(req.params.productId)
    const body = purchaseSchema.parse(req.body)
    await purchaseDigitalProduct(studentId, productId, body.paymentRef)
    return sendSuccess(res, { purchased: true })
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", e.message!, 404)
    if (e.code === "ALREADY_PURCHASED") return sendError(res, "ALREADY_PURCHASED", e.message!, 409)
    if (e.code === "PAYMENT_REQUIRED") return sendError(res, "PAYMENT_REQUIRED", e.message!, 402)
    next(err)
  }
}

export async function downloadProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const productId = param(req.params.productId)
    const { filepath, filename } = await getDigitalDownload(studentId, productId)
    return res.download(filepath, filename)
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === "NOT_PURCHASED") return sendError(res, "NOT_PURCHASED", e.message!, 403)
    if (e.code === "LIMIT_REACHED") return sendError(res, "LIMIT_REACHED", e.message!, 403)
    if (e.code === "FILE_NOT_FOUND") return sendError(res, "FILE_NOT_FOUND", e.message!, 404)
    next(err)
  }
}

export async function getMyPurchases(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const purchases = await getStudentPurchases(studentId)
    return sendSuccess(res, purchases)
  } catch (err) {
    next(err)
  }
}

export async function getPhysicalProducts(_req: Request, res: Response, next: NextFunction) {
  try {
    const products = await listPhysicalProducts()
    return sendSuccess(res, products)
  } catch (err) {
    next(err)
  }
}

const orderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().min(1).max(10),
    })
  ).min(1),
  shippingAddress: z.object({
    name: z.string(),
    phone: z.string(),
    address: z.string(),
    city: z.string(),
    postalCode: z.string().optional(),
  }),
  paymentRef: z.string().optional(),
  gateway: paymentGatewaySchema.optional(),
})

export async function placeOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const body = orderSchema.parse(req.body)

    if ((await isAnyPaymentGatewayAvailable()) && !body.paymentRef) {
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: { user: true },
      })
      if (!student) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

      const result = await createPayment(
        studentId,
        req.user!.userId,
        {
          kind: "physical_order",
          items: body.items,
          shippingAddress: body.shippingAddress,
          gateway: body.gateway,
        },
        {
          name: `${student.firstName} ${student.lastName}`,
          email: student.user.email,
          phone: student.phone || undefined,
        }
      )
      return sendSuccess(res, { ...result, requiresPayment: true }, 201)
    }

    const { createPhysicalOrder } = await import("../services/product.service")
    const order = await createPhysicalOrder(
      studentId,
      body.items,
      body.shippingAddress,
      body.paymentRef || `dev_order_${Date.now()}`
    )
    return sendSuccess(res, order, 201)
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", e.message!, 404)
    if (e.code === "OUT_OF_STOCK") return sendError(res, "OUT_OF_STOCK", e.message!, 409)
    if (e.code === "EMPTY_ORDER") return sendError(res, "EMPTY_ORDER", e.message!, 400)
    next(err)
  }
}

export async function getMyOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const orders = await getStudentOrders(studentId)
    return sendSuccess(res, orders)
  } catch (err) {
    next(err)
  }
}

export async function getMyOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const orderId = param(req.params.orderId)
    const order = await getStudentOrder(studentId, orderId)
    return sendSuccess(res, order)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function patchMyOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const orderId = param(req.params.orderId)
    const schema = z.object({
      action: z.enum(["cancel"]).optional(),
      shippingAddress: z
        .object({
          name: z.string().min(1),
          phone: z.string().min(1),
          address: z.string().min(1),
          city: z.string().min(1),
          district: z.string().min(1),
          postalCode: z.string().optional(),
        })
        .optional(),
    })
    const body = schema.parse(req.body)

    if (body.action === "cancel") {
      const order = await cancelStudentOrder(studentId, orderId)
      return sendSuccess(res, order)
    }

    if (body.shippingAddress) {
      const order = await updateStudentOrderAddress(
        studentId,
        orderId,
        body.shippingAddress
      )
      return sendSuccess(res, order)
    }

    return sendError(res, "INVALID_INPUT", "No valid update provided", 400)
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
