import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  getMentorSlots,
  bookMentorSlot,
  getStudentBookings,
  cancelMentorBooking,
  rescheduleMentorBooking,
} from "../services/mentor.service"
import { submitMentorBookingReview } from "../services/review.service"
import { parseConsultationTypeParam } from "../lib/consultation"
import { sendSuccess, sendError } from "../lib/response"
import { getStudentId } from "../lib/student"
import { param } from "../lib/params"

export async function getSlots(req: Request, res: Response, next: NextFunction) {
  try {
    const mentorId = param(req.params.mentorId)
    const slots = await getMentorSlots(mentorId)
    return sendSuccess(res, slots)
  } catch (err) {
    next(err)
  }
}

const bookSchema = z.object({
  paymentRef: z.string().optional(),
  consultationType: z.enum(["CAREER", "STUDY_ABROAD", "TRADING", "BUSINESS"]).optional(),
})

export async function bookSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const slotId = param(req.params.slotId)
    const body = bookSchema.parse(req.body)
    const consultationType = parseConsultationTypeParam(body.consultationType)
    const booking = await bookMentorSlot(studentId, slotId, body.paymentRef, consultationType)
    return sendSuccess(res, booking, 201)
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", e.message!, 404)
    if (e.code === "ALREADY_BOOKED") return sendError(res, "ALREADY_BOOKED", e.message!, 409)
    if (e.code === "PAYMENT_REQUIRED") return sendError(res, "PAYMENT_REQUIRED", e.message!, 402)
    if (e.code === "CONSULTATION_NOT_SUPPORTED") {
      return sendError(res, e.code, e.message!, 400)
    }
    next(err)
  }
}

export async function cancelBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const bookingId = param(req.params.bookingId)
    const result = await cancelMentorBooking(studentId, bookingId)
    return sendSuccess(res, result)
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", e.message!, 404)
    if (e.code === "CANCEL_WINDOW_PASSED") {
      return sendError(res, e.code, e.message!, 400)
    }
    next(err)
  }
}

export async function rescheduleBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const bookingId = param(req.params.bookingId)
    const { slotId } = z.object({ slotId: z.string().uuid() }).parse(req.body)
    const booking = await rescheduleMentorBooking(studentId, bookingId, slotId)
    return sendSuccess(res, booking)
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", e.message!, 404)
    if (e.code === "INVALID_SLOT") return sendError(res, e.code, e.message!, 400)
    if (e.code === "ALREADY_BOOKED") return sendError(res, e.code, e.message!, 409)
    if (e.code === "CANCEL_WINDOW_PASSED") {
      return sendError(res, e.code, e.message!, 400)
    }
    next(err)
  }
}

export async function reviewBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const bookingId = param(req.params.bookingId)
    const schema = z.object({
      rating: z.number().int().min(1).max(5),
      review: z.string().max(1000).optional(),
    })
    const body = schema.parse(req.body)

    try {
      const result = await submitMentorBookingReview(
        studentId,
        bookingId,
        body.rating,
        body.review
      )
      return sendSuccess(res, result)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
      if (code === "INVALID_STATE" || code === "ALREADY_REVIEWED" || code === "INVALID_RATING") {
        return sendError(res, code, (err as Error).message, 400)
      }
      throw err
    }
  } catch (err) {
    next(err)
  }
}

export async function getMyBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getStudentId(req.user!.userId)
    if (!studentId) return sendError(res, "NOT_FOUND", "Student profile not found", 404)

    const bookings = await getStudentBookings(studentId)
    return sendSuccess(res, bookings)
  } catch (err) {
    next(err)
  }
}
