import type { Order, OrderItem, OrderStatus, Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { paginatedResult, type PaginationParams } from "../lib/pagination"
import {
  sendOrderCancelledEmail,
  sendOrderDeliveredEmail,
  sendOrderProcessingEmail,
  sendOrderShippedEmail,
} from "./email.service"
import { notifyUser } from "./notification-dispatch.service"

const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000"

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CANCELLED"],
  PAYMENT_CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED", "CANCELLED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
}

const RESTOCK_ON_CANCEL: OrderStatus[] = ["PAYMENT_CONFIRMED", "PROCESSING", "SHIPPED"]
const RESTOCK_ON_RETURN: OrderStatus[] = ["SHIPPED", "DELIVERED"]

export interface OrderAdminFilters {
  search?: string
  status?: string
  from?: string
  to?: string
}

export interface UpdateAdminOrderInput {
  status?: OrderStatus
  trackingNumber?: string
  notes?: string
}

export interface UpdateAdminOrderOptions {
  adminUserId?: string
}

type OrderWithRelations = Order & {
  items: (OrderItem & { product: { name: string } })[]
  student: { firstName: string; lastName: string; user: { id: string; email: string } }
}

function assertTransition(current: OrderStatus, next: OrderStatus) {
  const allowed = ALLOWED_TRANSITIONS[current]
  if (!allowed.includes(next)) {
    throw Object.assign(
      new Error(`Cannot change order from ${current} to ${next}`),
      { code: "INVALID_TRANSITION" }
    )
  }
}

function parseShippingAddress(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return { name: "", phone: "", address: "", city: "", district: "", postalCode: "" }
  }
  const a = raw as Record<string, string>
  return {
    name: a.name ?? "",
    phone: a.phone ?? "",
    address: a.address ?? "",
    city: a.city ?? "",
    district: a.district ?? "",
    postalCode: a.postalCode ?? "",
  }
}

async function loadPaymentMeta(orderIds: string[]) {
  if (orderIds.length === 0) return new Map<string, { paymentId: string; paymentStatus: string }>()

  const payments = await prisma.paymentRecord.findMany({
    where: { type: "PHYSICAL_ORDER", entityId: { in: orderIds } },
    select: { id: true, entityId: true, status: true },
    orderBy: { createdAt: "desc" },
  })

  const map = new Map<string, { paymentId: string; paymentStatus: string }>()
  for (const payment of payments) {
    if (payment.entityId && !map.has(payment.entityId)) {
      map.set(payment.entityId, {
        paymentId: payment.id,
        paymentStatus: payment.status,
      })
    }
  }
  return map
}

function mapAdminOrder(
  order: OrderWithRelations,
  paymentMeta?: { paymentId: string; paymentStatus: string }
) {
  return {
    id: order.id,
    orderCode: order.orderCode,
    status: order.status,
    subtotal: Number(order.subtotal),
    shippingFee: Number(order.shippingFee),
    total: Number(order.total),
    currency: order.currency,
    studentName: `${order.student.firstName} ${order.student.lastName}`,
    studentEmail: order.student.user.email,
    shippingAddress: parseShippingAddress(order.shippingAddress),
    notes: order.notes,
    trackingNumber: order.trackingNumber,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    paymentId: paymentMeta?.paymentId ?? null,
    paymentStatus: paymentMeta?.paymentStatus ?? null,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({
      name: i.product.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
    })),
  }
}

async function restockItems(
  tx: Prisma.TransactionClient,
  items: OrderItem[]
) {
  for (const item of items) {
    await tx.physicalProduct.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    })
  }
}

/** Shared cancel + restock used by admin cancel and payment refunds */
export async function cancelOrderWithRestock(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      student: { include: { user: true } },
    },
  })
  if (!order) return

  if (order.status === "CANCELLED") return

  const hadPaidStock = RESTOCK_ON_CANCEL.includes(order.status)

  if (hadPaidStock) {
    await prisma.$transaction(async (tx) => {
      await restockItems(tx, order.items)
      await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED" },
      })
    })
  } else if (order.status !== "RETURNED") {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    })
  }

  const fullOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      student: { include: { user: true } },
      items: { include: { product: true } },
    },
  })
  if (fullOrder) {
    await notifyOrderStatusChange(fullOrder, "CANCELLED")
  }
}

async function maybeRefundCancelledOrder(
  orderId: string,
  options?: { reason?: string; adminUserId?: string }
) {
  const payment = await prisma.paymentRecord.findFirst({
    where: {
      entityId: orderId,
      type: "PHYSICAL_ORDER",
      status: "COMPLETED",
    },
  })
  if (!payment) return

  try {
    const { processRefund } = await import("./refund.service")
    await processRefund(
      payment.id,
      { type: "full", reason: options?.reason ?? "Order cancelled" },
      options?.adminUserId
    )
  } catch (err) {
    console.error(`[Order] Auto-refund failed for order ${orderId}:`, err)
  }
}

async function notifyOrderStatusChange(
  order: OrderWithRelations,
  status: OrderStatus,
  trackingNumber?: string | null,
  options?: { skipEmail?: boolean; refunded?: boolean }
) {
  const userId = order.student.user.id
  const email = order.student.user.email
  const firstName = order.student.firstName
  const link = `${frontendUrl()}/order/${order.id}`

  switch (status) {
    case "PROCESSING":
      await notifyUser({
        userId,
        type: "ORDER_PROCESSING",
        title: `Order processing: ${order.orderCode}`,
        message: "We're preparing your items for shipment",
        link,
      })
      if (!options?.skipEmail) {
        await sendOrderProcessingEmail(email, firstName, order.orderCode, order.id)
      }
      break
    case "SHIPPED":
      await notifyUser({
        userId,
        type: "ORDER_SHIPPED",
        title: `Order shipped: ${order.orderCode}`,
        message: trackingNumber
          ? `Tracking: ${trackingNumber}`
          : "Your order is on the way",
        link,
      })
      if (!options?.skipEmail) {
        await sendOrderShippedEmail(
          email,
          firstName,
          order.orderCode,
          order.id,
          trackingNumber
        )
      }
      break
    case "DELIVERED":
      await notifyUser({
        userId,
        type: "ORDER_DELIVERED",
        title: `Order delivered: ${order.orderCode}`,
        message: "Your package has been delivered",
        link,
      })
      if (!options?.skipEmail) {
        await sendOrderDeliveredEmail(email, firstName, order.orderCode, order.id)
      }
      break
    case "CANCELLED":
      await notifyUser({
        userId,
        type: "ORDER_CANCELLED",
        title: `Order cancelled: ${order.orderCode}`,
        message: options?.refunded
          ? "Your order was cancelled and a full refund has been issued."
          : "Your order was cancelled. Contact support if you have questions.",
        link,
      })
      if (!options?.skipEmail) {
        await sendOrderCancelledEmail(
          email,
          firstName,
          order.orderCode,
          order.id,
          options?.refunded
        )
      }
      break
    case "RETURNED":
      await notifyUser({
        userId,
        type: "ORDER_RETURNED",
        title: `Order returned: ${order.orderCode}`,
        message: "Your return has been recorded",
        link,
      })
      break
    default:
      break
  }
}

/** Notify student when a pending order is cancelled (e.g. student self-cancel or cleanup cron) */
export async function notifyPendingOrderCancelled(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      student: { include: { user: true } },
      items: { include: { product: true } },
    },
  })
  if (order) {
    await notifyOrderStatusChange(order, "CANCELLED")
  }
}

export async function listAdminOrders(
  pagination: PaginationParams,
  filters?: OrderAdminFilters
) {
  const { page, pageSize, skip } = pagination
  const where: Prisma.OrderWhereInput = {}

  if (filters?.status && filters.status !== "all") {
    where.status = filters.status as OrderStatus
  }

  if (filters?.from || filters?.to) {
    where.createdAt = {}
    if (filters.from) where.createdAt.gte = new Date(filters.from)
    if (filters.to) {
      const end = new Date(filters.to)
      end.setHours(23, 59, 59, 999)
      where.createdAt.lte = end
    }
  }

  if (filters?.search) {
    const q = filters.search
    where.OR = [
      { orderCode: { contains: q, mode: "insensitive" } },
      { student: { firstName: { contains: q, mode: "insensitive" } } },
      { student: { lastName: { contains: q, mode: "insensitive" } } },
      { student: { user: { email: { contains: q, mode: "insensitive" } } } },
    ]
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        student: { include: { user: true } },
        items: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ])

  const paymentMeta = await loadPaymentMeta(orders.map((o) => o.id))
  const items = orders.map((o) => mapAdminOrder(o, paymentMeta.get(o.id)))

  return paginatedResult(items, total, page, pageSize)
}

export async function getAdminOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      student: { include: { user: true } },
      items: { include: { product: true } },
    },
  })

  if (!order) {
    throw Object.assign(new Error("Order not found"), { code: "NOT_FOUND" })
  }

  const paymentMeta = await loadPaymentMeta([order.id])
  return mapAdminOrder(order, paymentMeta.get(order.id))
}

export async function updateAdminOrder(
  orderId: string,
  input: UpdateAdminOrderInput,
  options?: UpdateAdminOrderOptions
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      student: { include: { user: true } },
      items: { include: { product: true } },
    },
  })

  if (!order) {
    throw Object.assign(new Error("Order not found"), { code: "NOT_FOUND" })
  }

  const hasStatus = input.status !== undefined
  const hasMeta = input.notes !== undefined || input.trackingNumber !== undefined

  if (!hasStatus && !hasMeta) {
    throw Object.assign(new Error("No updates provided"), { code: "INVALID_INPUT" })
  }

  if (!hasStatus) {
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        notes: input.notes !== undefined ? input.notes.trim() || null : undefined,
        trackingNumber:
          input.trackingNumber !== undefined ? input.trackingNumber.trim() || null : undefined,
      },
      include: {
        student: { include: { user: true } },
        items: { include: { product: true } },
      },
    })
    const paymentMeta = await loadPaymentMeta([orderId])
    return mapAdminOrder(updated, paymentMeta.get(orderId))
  }

  const nextStatus = input.status!
  assertTransition(order.status, nextStatus)

  const now = new Date()
  const data: Prisma.OrderUpdateInput = { status: nextStatus }

  if (input.notes !== undefined) {
    data.notes = input.notes.trim() || null
  }

  if (input.trackingNumber !== undefined) {
    data.trackingNumber = input.trackingNumber.trim() || null
  }

  if (nextStatus === "SHIPPED") {
    data.shippedAt = order.shippedAt ?? now
    if (input.trackingNumber?.trim()) {
      data.trackingNumber = input.trackingNumber.trim()
    }
  }

  if (nextStatus === "DELIVERED") {
    data.deliveredAt = order.deliveredAt ?? now
  }

  let updated: OrderWithRelations

  if (nextStatus === "CANCELLED" && RESTOCK_ON_CANCEL.includes(order.status)) {
    updated = await prisma.$transaction(async (tx) => {
      await restockItems(tx, order.items)
      return tx.order.update({
        where: { id: orderId },
        data,
        include: {
          student: { include: { user: true } },
          items: { include: { product: true } },
        },
      })
    })
  } else if (nextStatus === "RETURNED" && RESTOCK_ON_RETURN.includes(order.status)) {
    updated = await prisma.$transaction(async (tx) => {
      await restockItems(tx, order.items)
      return tx.order.update({
        where: { id: orderId },
        data,
        include: {
          student: { include: { user: true } },
          items: { include: { product: true } },
        },
      })
    })
  } else {
    updated = await prisma.order.update({
      where: { id: orderId },
      data,
      include: {
        student: { include: { user: true } },
        items: { include: { product: true } },
      },
    })
  }

  let refunded = false
  if (nextStatus === "CANCELLED") {
    const payment = await prisma.paymentRecord.findFirst({
      where: {
        entityId: orderId,
        type: "PHYSICAL_ORDER",
        status: "COMPLETED",
      },
    })
    if (payment) {
      await maybeRefundCancelledOrder(orderId, {
        reason: "Order cancelled",
        adminUserId: options?.adminUserId,
      })
      const after = await prisma.paymentRecord.findUnique({ where: { id: payment.id } })
      refunded = after?.status === "REFUNDED"
    }
  }

  await notifyOrderStatusChange(updated, nextStatus, updated.trackingNumber, {
    refunded: nextStatus === "CANCELLED" ? refunded : undefined,
  })

  const paymentMeta = await loadPaymentMeta([orderId])
  return mapAdminOrder(updated, paymentMeta.get(orderId))
}

/** @deprecated Use updateAdminOrder */
export async function updateOrderStatus(orderId: string, status: string) {
  return updateAdminOrder(orderId, { status: status as OrderStatus })
}

const DELETABLE_STATUSES: OrderStatus[] = ["PENDING", "CANCELLED", "RETURNED"]

export async function deleteAdminOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) {
    throw Object.assign(new Error("Order not found"), { code: "NOT_FOUND" })
  }

  if (!DELETABLE_STATUSES.includes(order.status)) {
    throw Object.assign(
      new Error("Cancel the order before deleting it from the system"),
      { code: "INVALID_STATE" }
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentRecord.updateMany({
      where: {
        entityId: orderId,
        type: "PHYSICAL_ORDER",
        status: "PENDING",
      },
      data: { status: "FAILED" },
    })
    await tx.paymentRecord.deleteMany({
      where: {
        entityId: orderId,
        type: "PHYSICAL_ORDER",
        status: { in: ["FAILED", "REFUNDED"] },
      },
    })
    await tx.order.delete({ where: { id: orderId } })
  })

  return { deleted: true, id: orderId }
}
