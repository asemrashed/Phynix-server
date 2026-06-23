import { prisma } from "../lib/prisma"
import type { OrderItem as StudentOrderItem } from "@fxprime/types"
import { notifyPendingOrderCancelled, updateAdminOrder } from "./order-admin.service"

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

function mapStudentOrder(
  order: {
    id: string
    orderCode: string
    status: string
    subtotal: { toString(): string }
    shippingFee: { toString(): string }
    total: { toString(): string }
    currency: string
    shippingAddress: unknown
    trackingNumber: string | null
    shippedAt: Date | null
    deliveredAt: Date | null
    createdAt: Date
    items: Array<{
      quantity: number
      unitPrice: { toString(): string }
      product: { name: string }
    }>
  }
): StudentOrderItem {
  return {
    id: order.id,
    orderCode: order.orderCode,
    status: order.status,
    subtotal: Number(order.subtotal),
    shippingFee: Number(order.shippingFee),
    total: Number(order.total),
    currency: order.currency,
    shippingAddress: parseShippingAddress(order.shippingAddress),
    trackingNumber: order.trackingNumber,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({
      name: i.product.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
    })),
  }
}

export async function getStudentOrder(studentId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, studentId },
    include: { items: { include: { product: true } } },
  })

  if (!order) {
    throw Object.assign(new Error("Order not found"), { code: "NOT_FOUND" })
  }

  return mapStudentOrder(order)
}

export async function cancelStudentOrder(studentId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, studentId },
  })

  if (!order) {
    throw Object.assign(new Error("Order not found"), { code: "NOT_FOUND" })
  }

  if (order.status === "PENDING") {
    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED" },
      }),
      prisma.paymentRecord.updateMany({
        where: {
          entityId: orderId,
          type: "PHYSICAL_ORDER",
          status: "PENDING",
        },
        data: { status: "FAILED" },
      }),
    ])
    await notifyPendingOrderCancelled(orderId)
    return getStudentOrder(studentId, orderId)
  }

  if (order.status === "PAYMENT_CONFIRMED") {
    await updateAdminOrder(orderId, { status: "CANCELLED" })
    return getStudentOrder(studentId, orderId)
  }

  throw Object.assign(new Error("This order can no longer be cancelled"), {
    code: "INVALID_STATE",
  })
}

export async function updateStudentOrderAddress(
  studentId: string,
  orderId: string,
  shippingAddress: Record<string, string>
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, studentId, status: "PENDING" },
  })

  if (!order) {
    throw Object.assign(new Error("Order not found or cannot be updated"), {
      code: "NOT_FOUND",
    })
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { shippingAddress },
  })

  return getStudentOrder(studentId, orderId)
}
