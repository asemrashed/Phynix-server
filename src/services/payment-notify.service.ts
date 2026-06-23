import { prisma } from "../lib/prisma"
import { getConsultationLabel } from "@fxprime/types"
import { notifyUser } from "./notification-dispatch.service"

type PaymentType =
  | "COURSE"
  | "DIGITAL_PRODUCT"
  | "PHYSICAL_ORDER"
  | "SUBSCRIPTION"
  | "MENTOR_BOOKING"

export async function notifyPaymentSuccess(
  _paymentId: string,
  type: PaymentType,
  studentId: string,
  userId: string,
  entityId?: string | null
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  })
  if (!student) return

  const { firstName } = student
  const email = student.user.email
  const base = frontendUrl()

  switch (type) {
    case "COURSE": {
      const course = entityId
        ? await prisma.course.findUnique({ where: { id: entityId } })
        : null
      await notifyUser({
        userId,
        type: "PAYMENT_SUCCESS",
        title: "Enrollment Confirmed",
        message: course
          ? `You are enrolled in ${course.title}`
          : "Course payment successful",
        link: `${base}/dashboard/courses`,
      })
      break
    }
    case "DIGITAL_PRODUCT": {
      const product = entityId
        ? await prisma.digitalProduct.findUnique({ where: { id: entityId } })
        : null
      if (product) {
        await notifyUser({
          userId,
          type: "PAYMENT_SUCCESS",
          title: "Product Purchased",
          message: `${product.title} added to your library`,
          link: `${base}/dashboard/products`,
          email: {
            to: email,
            firstName,
            template: { name: "digital_product", productTitle: product.title },
          },
        })
      }
      break
    }
    case "PHYSICAL_ORDER": {
      const order = entityId
        ? await prisma.order.findUnique({ where: { id: entityId } })
        : null
      if (order) {
        await notifyUser({
          userId,
          type: "PAYMENT_SUCCESS",
          title: "Order Confirmed",
          message: `Order ${order.orderCode} is being processed`,
          link: `${base}/dashboard/orders`,
          email: {
            to: email,
            firstName,
            template: {
              name: "order_confirmation",
              orderCode: order.orderCode,
              total: Number(order.total),
              currency: order.currency,
            },
          },
        })
      }
      break
    }
    case "SUBSCRIPTION": {
      const plan = entityId || "PRO"
      await notifyUser({
        userId,
        type: "PAYMENT_SUCCESS",
        title: "Subscription Active",
        message: `Your ${plan} plan is now active`,
        link: `${base}/dashboard/settings`,
        email: {
          to: email,
          firstName,
          template: { name: "subscription", plan },
        },
      })
      break
    }
    case "MENTOR_BOOKING": {
      const booking = entityId
        ? await prisma.mentorBooking.findFirst({
            where: { slotId: entityId, studentId },
            include: { mentor: true, slot: true },
            orderBy: { createdAt: "desc" },
          })
        : null
      if (booking) {
        const consultationLabel = getConsultationLabel(booking.consultationType)
        await notifyUser({
          userId,
          type: "MENTOR_BOOKING",
          title: consultationLabel ? `${consultationLabel} Booked` : "Mentor Session Booked",
          message: consultationLabel
            ? `${consultationLabel} with ${booking.mentor.displayName} confirmed`
            : `Session with ${booking.mentor.displayName} confirmed`,
          link: `${base}/dashboard/mentorship`,
          email: {
            to: email,
            firstName,
            template: {
              name: "mentor_booking",
              mentorName: booking.mentor.displayName,
              scheduledAt: booking.slot.date.toISOString(),
              consultationTypeLabel: consultationLabel ?? undefined,
            },
          },
        })
      }
      break
    }
  }
}

function frontendUrl() {
  return process.env.FRONTEND_URL || "http://localhost:3000"
}
