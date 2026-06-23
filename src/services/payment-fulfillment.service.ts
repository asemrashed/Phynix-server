import type { PlanType, ConsultationType } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { enrollInCourse } from "./course.service"
import { purchaseDigitalProduct } from "./product.service"
import { subscribeToPlan } from "./subscription.service"
import { registerForSession } from "./session.service"
import { bookMentorSlot } from "./mentor.service"
import { notifyPaymentSuccess } from "./payment-notify.service"

export async function fulfillPayment(paymentId: string, paymentRef: string) {
  const payment = await prisma.paymentRecord.findUnique({ where: { id: paymentId } })
  if (!payment) throw Object.assign(new Error("Payment not found"), { code: "NOT_FOUND" })
  if (payment.status === "COMPLETED") return payment

  const student = await prisma.student.findUnique({
    where: { id: payment.studentId },
    include: { user: true },
  })
  if (!student) throw Object.assign(new Error("Student not found"), { code: "NOT_FOUND" })

  await prisma.paymentRecord.update({
    where: { id: paymentId },
    data: { status: "COMPLETED", paymentRef },
  })

  const meta = payment.metadata as { installmentNo?: number } | null
  const isLaterInstallment = Boolean(meta?.installmentNo && meta.installmentNo > 1)

  switch (payment.type) {
    case "COURSE":
      if (payment.courseId && !isLaterInstallment) {
        await enrollInCourse(payment.studentId, payment.courseId, student.userId)
      }
      break
    case "DIGITAL_PRODUCT":
      if (payment.entityId) {
        await purchaseDigitalProduct(payment.studentId, payment.entityId, paymentRef)
      }
      break
    case "PHYSICAL_ORDER":
      if (payment.entityId) {
        const order = await prisma.order.findUnique({
          where: { id: payment.entityId },
          include: { items: true },
        })
        if (order && order.status === "PENDING") {
          await prisma.$transaction(async (tx) => {
            for (const item of order.items) {
              const updated = await tx.physicalProduct.updateMany({
                where: { id: item.productId, stock: { gte: item.quantity } },
                data: { stock: { decrement: item.quantity } },
              })
              if (updated.count === 0) {
                throw Object.assign(new Error(`Insufficient stock for product ${item.productId}`), {
                  code: "OUT_OF_STOCK",
                })
              }
            }
            await tx.order.update({
              where: { id: payment.entityId! },
              data: { status: "PAYMENT_CONFIRMED", paymentRef, gateway: "sslcommerz" },
            })
          })
        }
      }
      break
    case "SUBSCRIPTION": {
      const plan = payment.entityId as Exclude<PlanType, "FREE">
      await subscribeToPlan(payment.studentId, plan, paymentRef)
      const meta = payment.metadata as { sessionId?: string } | null
      if (meta?.sessionId) {
        try {
          await registerForSession(payment.studentId, meta.sessionId)
        } catch (err) {
          console.warn("[fulfillPayment] session auto-register skipped:", (err as Error).message)
        }
      }
      break
    }
    case "MENTOR_BOOKING":
      if (payment.entityId) {
        const meta = payment.metadata as { consultationType?: ConsultationType } | null
        await bookMentorSlot(
          payment.studentId,
          payment.entityId,
          paymentRef,
          meta?.consultationType ?? null
        )
      }
      break
  }

  await notifyPaymentSuccess(
    paymentId,
    payment.type,
    payment.studentId,
    student.userId,
    payment.type === "COURSE" ? payment.courseId : payment.entityId
  )

  return prisma.paymentRecord.findUniqueOrThrow({ where: { id: paymentId } })
}
