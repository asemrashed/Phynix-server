import { prisma } from "../lib/prisma"
import { invalidateCached } from "../lib/cache"

const mentorSlotsCacheKey = (mentorId: string) => `mentor:slots:${mentorId}`

export async function invalidateMentorSlotsCache(mentorId: string) {
  await invalidateCached(mentorSlotsCacheKey(mentorId))
}

export async function createMentorSlot(mentorId: string, date: string) {
  const mentor = await prisma.mentor.findUnique({ where: { id: mentorId } })
  if (!mentor) {
    throw Object.assign(new Error("Mentor not found"), { code: "NOT_FOUND" })
  }

  const slotDate = new Date(date)
  if (slotDate <= new Date()) {
    throw Object.assign(new Error("Slot must be in the future"), { code: "INVALID_DATE" })
  }

  const slot = await prisma.mentorSlot.create({
    data: { mentorId, date: slotDate },
  })

  await invalidateMentorSlotsCache(mentorId)

  return {
    id: slot.id,
    mentorId: slot.mentorId,
    date: slot.date.toISOString(),
    isBooked: slot.isBooked,
  }
}

export async function deleteMentorSlot(mentorId: string, slotId: string) {
  const slot = await prisma.mentorSlot.findFirst({
    where: { id: slotId, mentorId },
  })

  if (!slot) {
    throw Object.assign(new Error("Slot not found"), { code: "NOT_FOUND" })
  }

  if (slot.isBooked) {
    throw Object.assign(new Error("Cannot delete a booked slot"), { code: "SLOT_BOOKED" })
  }

  await prisma.mentorSlot.delete({ where: { id: slotId } })
  await invalidateMentorSlotsCache(mentorId)
  return { deleted: true }
}
