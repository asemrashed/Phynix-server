import type { Prisma } from "@prisma/client"
import type { ConsultationType } from "@fxprime/types"
import { getConsultationLabel } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { paginatedResult, type PaginationParams } from "../lib/pagination"
import { getCached, setCached } from "../lib/cache"
import { gateJoinUrl, getSessionPhase } from "../lib/meeting-access"
import { assertMentorSupportsConsultation } from "../lib/consultation"
import { invalidateMentorSlotsCache } from "./mentor-slots.service"
import {
  canModifyBooking,
  MENTOR_CANCEL_HOURS,
  getMentorReminderFlags,
} from "../lib/mentor-policy"
import { notifyUser } from "./notification-dispatch.service"

const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000"

function mapBookingItem(
  b: {
    id: string
    mentorId: string
    status: string
    consultationType: ConsultationType | null
    zoomUrl: string | null
    rating: number | null
    review: string | null
    sessionNotes: string | null
    createdAt: Date
    mentor: { displayName: string; sessionDurationMinutes: number }
    slot: { date: Date }
  }
) {
  const gated = gateJoinUrl(
    b.zoomUrl,
    b.slot.date,
    b.mentor.sessionDurationMinutes
  )
  const canModify = canModifyBooking(b.slot.date, b.status)
  const ended = getSessionPhase(b.slot.date, b.mentor.sessionDurationMinutes) === "ended"
  return {
    id: b.id,
    mentorId: b.mentorId,
    mentorName: b.mentor.displayName,
    scheduledAt: b.slot.date.toISOString(),
    status: b.status,
    consultationType: b.consultationType,
    consultationTypeLabel: getConsultationLabel(b.consultationType),
    zoomUrl: gated.joinUrl,
    canJoin: gated.canJoin,
    joinOpensAt: gated.joinOpensAt,
    rating: b.rating,
    review: b.review,
    sessionNotes: b.sessionNotes,
    canReview:
      (b.status === "COMPLETED" || (b.status === "CONFIRMED" && ended)) &&
      b.rating === null,
    canCancel: canModify,
    canReschedule: canModify,
    cancelPolicyHours: MENTOR_CANCEL_HOURS,
    createdAt: b.createdAt.toISOString(),
  }
}

const MENTOR_SLOTS_CACHE_TTL = 300

export async function getMentorSlots(mentorId: string) {
  const cacheKey = `mentor:slots:${mentorId}`
  const cached = await getCached<
    { id: string; mentorId: string; date: string; isBooked: boolean }[]
  >(cacheKey)
  if (cached) return cached

  const slots = await prisma.mentorSlot.findMany({
    where: {
      mentorId,
      isBooked: false,
      date: { gte: new Date() },
    },
    orderBy: { date: "asc" },
    take: 60,
  })

  const mapped = slots.map((s) => ({
    id: s.id,
    mentorId: s.mentorId,
    date: s.date.toISOString(),
    isBooked: s.isBooked,
  }))

  await setCached(cacheKey, mapped, MENTOR_SLOTS_CACHE_TTL)
  return mapped
}

export async function getStudentBookings(studentId: string) {
  const bookings = await prisma.mentorBooking.findMany({
    where: { studentId },
    include: { mentor: true, slot: true },
    orderBy: { createdAt: "desc" },
  })

  return bookings.map(mapBookingItem)
}

async function notifyBookingConfirmed(
  studentId: string,
  mentorName: string,
  scheduledAt: Date,
  consultationType?: ConsultationType | null
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  })
  if (!student) return

  const consultationLabel = getConsultationLabel(consultationType)
  const title = consultationLabel ? `${consultationLabel} Booked` : "Mentor Session Booked"
  const message = consultationLabel
    ? `${consultationLabel} with ${mentorName} confirmed`
    : `Session with ${mentorName} confirmed`

  await notifyUser({
    userId: student.userId,
    type: "MENTOR_BOOKING",
    title,
    message,
    link: `${frontendUrl()}/dashboard/mentorship`,
    email: {
      to: student.user.email,
      firstName: student.firstName,
      template: {
        name: "mentor_booking",
        mentorName,
        scheduledAt: scheduledAt.toISOString(),
        consultationTypeLabel: consultationLabel ?? undefined,
      },
    },
  })
}

export async function bookMentorSlot(
  studentId: string,
  slotId: string,
  paymentRef?: string,
  consultationType?: ConsultationType | null
) {
  const slot = await prisma.mentorSlot.findUnique({
    where: { id: slotId },
    include: { mentor: true },
  })

  if (!slot) {
    throw Object.assign(new Error("Slot not found"), { code: "NOT_FOUND" })
  }
  if (slot.isBooked) {
    throw Object.assign(new Error("Slot already booked"), { code: "ALREADY_BOOKED" })
  }

  const price = Number(slot.mentor.pricePerSession)
  if (price > 0 && !paymentRef) {
    throw Object.assign(new Error("Payment required"), { code: "PAYMENT_REQUIRED" })
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  })
  if (!student) {
    throw Object.assign(new Error("Student not found"), { code: "NOT_FOUND" })
  }

  if (consultationType) {
    assertMentorSupportsConsultation(slot.mentor.specializations, consultationType)
  }

  const booking = await prisma.$transaction(async (tx) => {
    const locked = await tx.mentorSlot.updateMany({
      where: { id: slotId, isBooked: false },
      data: { isBooked: true },
    })
    if (locked.count === 0) {
      throw Object.assign(new Error("Slot already booked"), { code: "ALREADY_BOOKED" })
    }

    return tx.mentorBooking.create({
      data: {
        studentId,
        mentorId: slot.mentorId,
        slotId,
        paymentRef,
        consultationType: consultationType ?? undefined,
        status: "CONFIRMED",
        zoomUrl: null,
        meetingExternalId: null,
        reminderFlags: {},
      },
      include: { mentor: true, slot: true },
    })
  })

  await prisma.mentor.update({
    where: { id: slot.mentorId },
    data: { totalSessions: { increment: 1 } },
  })

  await invalidateMentorSlotsCache(slot.mentorId)

  if (price === 0) {
    await notifyBookingConfirmed(
      studentId,
      booking.mentor.displayName,
      booking.slot.date,
      booking.consultationType
    )
  }

  return mapBookingItem(booking)
}

export async function cancelMentorBooking(studentId: string, bookingId: string) {
  const booking = await prisma.mentorBooking.findUnique({
    where: { id: bookingId },
    include: { mentor: true, slot: true, student: { include: { user: true } } },
  })

  if (!booking || booking.studentId !== studentId) {
    throw Object.assign(new Error("Booking not found"), { code: "NOT_FOUND" })
  }
  if (!canModifyBooking(booking.slot.date, booking.status)) {
    throw Object.assign(
      new Error(`Cancellation requires at least ${MENTOR_CANCEL_HOURS} hours notice`),
      { code: "CANCEL_WINDOW_PASSED" }
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.mentorBooking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED" },
    })
    await tx.mentorSlot.update({
      where: { id: booking.slotId },
      data: { isBooked: false },
    })
  })

  await notifyUser({
    userId: booking.student.user.id,
    type: "MENTOR_CANCELLED",
    title: "Session Cancelled",
    message: `Your session with ${booking.mentor.displayName} was cancelled`,
    link: `${frontendUrl()}/dashboard/mentorship`,
    email: {
      to: booking.student.user.email,
      firstName: booking.student.firstName,
      template: {
        name: "mentor_cancelled",
        mentorName: booking.mentor.displayName,
        scheduledAt: booking.slot.date.toISOString(),
      },
    },
  })

  return { id: bookingId, status: "CANCELLED" }
}

export async function rescheduleMentorBooking(
  studentId: string,
  bookingId: string,
  newSlotId: string
) {
  const booking = await prisma.mentorBooking.findUnique({
    where: { id: bookingId },
    include: { mentor: true, slot: true, student: { include: { user: true } } },
  })

  if (!booking || booking.studentId !== studentId) {
    throw Object.assign(new Error("Booking not found"), { code: "NOT_FOUND" })
  }
  if (!canModifyBooking(booking.slot.date, booking.status)) {
    throw Object.assign(
      new Error(`Reschedule requires at least ${MENTOR_CANCEL_HOURS} hours notice`),
      { code: "CANCEL_WINDOW_PASSED" }
    )
  }

  const newSlot = await prisma.mentorSlot.findUnique({
    where: { id: newSlotId },
    include: { mentor: true },
  })

  if (!newSlot || newSlot.mentorId !== booking.mentorId) {
    throw Object.assign(new Error("Invalid slot for this mentor"), { code: "INVALID_SLOT" })
  }
  if (newSlot.isBooked) {
    throw Object.assign(new Error("Slot already booked"), { code: "ALREADY_BOOKED" })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const locked = await tx.mentorSlot.updateMany({
      where: { id: newSlotId, isBooked: false },
      data: { isBooked: true },
    })
    if (locked.count === 0) {
      throw Object.assign(new Error("Slot already booked"), { code: "ALREADY_BOOKED" })
    }

    await tx.mentorSlot.update({
      where: { id: booking.slotId },
      data: { isBooked: false },
    })

    return tx.mentorBooking.update({
      where: { id: bookingId },
      data: {
        slotId: newSlotId,
        reminderFlags: {},
        status: "CONFIRMED",
      },
      include: { mentor: true, slot: true },
    })
  })

  await invalidateMentorSlotsCache(booking.mentorId)

  await notifyUser({
    userId: booking.student.user.id,
    type: "MENTOR_RESCHEDULED",
    title: "Session Rescheduled",
    message: `Your session with ${booking.mentor.displayName} was moved`,
    link: `${frontendUrl()}/dashboard/mentorship`,
    email: {
      to: booking.student.user.email,
      firstName: booking.student.firstName,
      template: {
        name: "mentor_rescheduled",
        mentorName: booking.mentor.displayName,
        scheduledAt: updated.slot.date.toISOString(),
      },
    },
  })

  return mapBookingItem(updated)
}

export async function updateMentorBookingNotes(
  bookingId: string,
  sessionNotes: string | null
) {
  const existing = await prisma.mentorBooking.findUnique({ where: { id: bookingId } })
  if (!existing) {
    throw Object.assign(new Error("Booking not found"), { code: "NOT_FOUND" })
  }

  const booking = await prisma.mentorBooking.update({
    where: { id: bookingId },
    data: {
      sessionNotes: sessionNotes?.trim() || null,
      status:
        sessionNotes?.trim() && existing.status === "CONFIRMED"
          ? "COMPLETED"
          : existing.status,
    },
    include: { mentor: true, slot: true },
  })
  return mapBookingItem(booking)
}

export async function listMentorBookingsForAdmin(
  mentorId: string,
  pagination: PaginationParams
) {
  const { page, pageSize, skip } = pagination
  const where: Prisma.MentorBookingWhereInput = {
    mentorId,
    status: { in: ["CONFIRMED", "COMPLETED"] },
  }

  const [bookings, total] = await Promise.all([
    prisma.mentorBooking.findMany({
      where,
      include: {
        mentor: true,
        slot: true,
        student: { select: { firstName: true, lastName: true } },
      },
      orderBy: { slot: { date: "desc" } },
      skip,
      take: pageSize,
    }),
    prisma.mentorBooking.count({ where }),
  ])

  const items = bookings.map((b) => ({
    id: b.id,
    studentName: `${b.student.firstName} ${b.student.lastName}`,
    scheduledAt: b.slot.date.toISOString(),
    status: b.status,
    consultationType: b.consultationType,
    consultationTypeLabel: getConsultationLabel(b.consultationType),
    sessionNotes: b.sessionNotes,
    rating: b.rating,
  }))

  return paginatedResult(items, total, page, pageSize)
}

export async function processMentorReminders() {
  const now = new Date()
  let sent = 0

  const bookings = await prisma.mentorBooking.findMany({
    where: { status: "CONFIRMED" },
    include: {
      mentor: true,
      slot: true,
      student: { include: { user: true } },
    },
  })

  for (const booking of bookings) {
    const hoursUntil =
      (booking.slot.date.getTime() - now.getTime()) / (60 * 60 * 1000)
    if (hoursUntil <= 0) continue

    const flags = getMentorReminderFlags(booking.reminderFlags)
    const updates: Record<string, string> = {}

    if (hoursUntil <= 24 && hoursUntil > 23 && !flags.twentyFourHour) {
      await notifyUser({
        userId: booking.student.user.id,
        type: "MENTOR_REMINDER",
        title: "Session in 24 hours",
        message: `Mentor session with ${booking.mentor.displayName} tomorrow`,
        link: `${frontendUrl()}/dashboard/mentorship`,
        email: {
          to: booking.student.user.email,
          firstName: booking.student.firstName,
          template: {
            name: "mentor_reminder",
            mentorName: booking.mentor.displayName,
            scheduledAt: booking.slot.date.toISOString(),
            hoursBefore: 24,
          },
        },
      })
      updates.twentyFourHour = now.toISOString()
      sent++
    }

    if (hoursUntil <= 1 && hoursUntil > 0.5 && !flags.oneHour) {
      await notifyUser({
        userId: booking.student.user.id,
        type: "MENTOR_REMINDER",
        title: "Session in 1 hour",
        message: `Mentor session with ${booking.mentor.displayName} starts soon`,
        link: `${frontendUrl()}/dashboard/mentorship`,
        email: {
          to: booking.student.user.email,
          firstName: booking.student.firstName,
          template: {
            name: "mentor_reminder",
            mentorName: booking.mentor.displayName,
            scheduledAt: booking.slot.date.toISOString(),
            hoursBefore: 1,
          },
        },
      })
      updates.oneHour = now.toISOString()
      sent++
    }

    if (Object.keys(updates).length > 0) {
      await prisma.mentorBooking.update({
        where: { id: booking.id },
        data: {
          reminderFlags: { ...flags, ...updates },
        },
      })
    }
  }

  return { sent }
}
