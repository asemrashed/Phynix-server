import { prisma } from "../lib/prisma"
import { getConsultationLabel } from "@fxprime/types"
import { gateJoinUrl } from "../lib/meeting-access"
import { updateMentorBookingNotes } from "./mentor.service"
import { createMentorSlot, deleteMentorSlot } from "./mentor-slots.service"

async function requireMentor(userId: string) {
  const mentor = await prisma.mentor.findUnique({
    where: { userId },
  })
  if (!mentor) {
    throw Object.assign(new Error("Mentor profile not found"), { code: "NOT_FOUND" })
  }
  return mentor
}

export async function getMentorPanelProfile(userId: string) {
  const mentor = await requireMentor(userId)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  return {
    id: mentor.id,
    email: user?.email ?? "",
    displayName: mentor.displayName,
    bio: mentor.bio,
    photoUrl: mentor.photoUrl,
    isAvailable: mentor.isAvailable,
    totalSessions: mentor.totalSessions,
    averageRating: Number(mentor.averageRating),
    pricePerSession: Number(mentor.pricePerSession),
    currency: mentor.currency,
    sessionDurationMinutes: mentor.sessionDurationMinutes,
  }
}

export async function updateMentorPanelProfile(
  userId: string,
  data: { displayName?: string; bio?: string | null; isAvailable?: boolean }
) {
  const mentor = await requireMentor(userId)
  const updated = await prisma.mentor.update({
    where: { id: mentor.id },
    data: {
      displayName: data.displayName?.trim() || mentor.displayName,
      bio: data.bio !== undefined ? data.bio?.trim() || null : mentor.bio,
      isAvailable: data.isAvailable ?? mentor.isAvailable,
    },
  })
  return {
    id: updated.id,
    displayName: updated.displayName,
    bio: updated.bio,
    isAvailable: updated.isAvailable,
    pricePerSession: Number(updated.pricePerSession),
    currency: updated.currency,
    sessionDurationMinutes: updated.sessionDurationMinutes,
  }
}

export async function getMentorPanelBookings(userId: string) {
  const mentor = await requireMentor(userId)

  const bookings = await prisma.mentorBooking.findMany({
    where: { mentorId: mentor.id },
    include: {
      mentor: true,
      slot: true,
      student: { select: { firstName: true, lastName: true, uniqueStudentId: true } },
    },
    orderBy: { slot: { date: "desc" } },
    take: 50,
  })

  return bookings.map((b) => {
    const gated = gateJoinUrl(b.zoomUrl, b.slot.date, b.mentor.sessionDurationMinutes)
    return {
      id: b.id,
      studentName: `${b.student.firstName} ${b.student.lastName}`,
      studentId: b.student.uniqueStudentId,
      scheduledAt: b.slot.date.toISOString(),
      status: b.status,
      consultationType: b.consultationType,
      consultationTypeLabel: getConsultationLabel(b.consultationType),
      zoomUrl: gated.joinUrl,
      canJoin: gated.canJoin,
      sessionNotes: b.sessionNotes,
      rating: b.rating,
      review: b.review,
      createdAt: b.createdAt.toISOString(),
    }
  })
}

export async function getMentorPanelSlots(userId: string) {
  const mentor = await requireMentor(userId)

  const slots = await prisma.mentorSlot.findMany({
    where: {
      mentorId: mentor.id,
      date: { gte: new Date() },
    },
    orderBy: { date: "asc" },
    take: 60,
  })

  return slots.map((s) => ({
    id: s.id,
    date: s.date.toISOString(),
    isBooked: s.isBooked,
  }))
}

export async function saveMentorSessionNotes(
  userId: string,
  bookingId: string,
  sessionNotes: string | null
) {
  const mentor = await requireMentor(userId)

  const booking = await prisma.mentorBooking.findUnique({
    where: { id: bookingId },
  })
  if (!booking || booking.mentorId !== mentor.id) {
    throw Object.assign(new Error("Booking not found"), { code: "NOT_FOUND" })
  }

  return updateMentorBookingNotes(bookingId, sessionNotes)
}

export async function getMentorPanelStats(userId: string) {
  const mentor = await requireMentor(userId)
  const now = new Date()

  const [upcomingSessions, openSlots, completedSessions] = await Promise.all([
    prisma.mentorBooking.count({
      where: {
        mentorId: mentor.id,
        status: { in: ["CONFIRMED", "PENDING"] },
        slot: { date: { gte: now } },
      },
    }),
    prisma.mentorSlot.count({
      where: { mentorId: mentor.id, isBooked: false, date: { gte: now } },
    }),
    prisma.mentorBooking.count({
      where: { mentorId: mentor.id, status: "COMPLETED" },
    }),
  ])

  return {
    upcomingSessions,
    openSlots,
    completedSessions,
    averageRating: Number(mentor.averageRating),
  }
}

export async function createMentorPanelSlot(userId: string, date: string) {
  const mentor = await requireMentor(userId)
  return createMentorSlot(mentor.id, date)
}

export async function deleteMentorPanelSlot(userId: string, slotId: string) {
  const mentor = await requireMentor(userId)
  return deleteMentorSlot(mentor.id, slotId)
}
