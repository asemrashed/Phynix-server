import { prisma } from "../lib/prisma"
import { notifyPendingOrderCancelled } from "../services/order-admin.service"

const CLEANUP_HOURS = Number(process.env.ORDER_CLEANUP_HOURS || 24)

export async function cleanupExpiredOrdersAndPayments() {
  const cutoff = new Date(Date.now() - CLEANUP_HOURS * 60 * 60 * 1000)

  const expiredOrders = await prisma.order.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    select: { id: true },
  })

  let orderCount = 0
  for (const { id } of expiredOrders) {
    await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: { status: "CANCELLED" },
      }),
      prisma.paymentRecord.updateMany({
        where: {
          entityId: id,
          type: "PHYSICAL_ORDER",
          status: "PENDING",
        },
        data: { status: "FAILED" },
      }),
    ])
    await notifyPendingOrderCancelled(id)
    orderCount++
  }

  const expiredPayments = await prisma.paymentRecord.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
      gateway: { notIn: ["bkash", "nagad"] },
      OR: [{ entityId: null }, { type: { not: "PHYSICAL_ORDER" } }],
    },
    data: { status: "FAILED" },
  })

  if (orderCount > 0 || expiredPayments.count > 0) {
    console.log(
      `[Order Cleanup] Cancelled ${orderCount} orders, failed ${expiredPayments.count} orphan payments`
    )
  }

  return { orders: orderCount, payments: expiredPayments.count }
}

export function startOrderCleanupScheduler() {
  const intervalMs = Number(process.env.ORDER_CLEANUP_INTERVAL_MS || 60 * 60 * 1000)

  setInterval(() => {
    cleanupExpiredOrdersAndPayments().catch((err) => {
      console.error("[Order Cleanup] Failed:", err)
    })
  }, intervalMs)

  cleanupExpiredOrdersAndPayments().catch(console.error)
  console.log(`[Order Cleanup] Scheduler started (every ${intervalMs / 60000}min)`)
}
