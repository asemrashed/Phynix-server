import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"
import {
  getMentorPanelProfile,
  updateMentorPanelProfile,
  getMentorPanelBookings,
  getMentorPanelSlots,
  saveMentorSessionNotes,
  getMentorPanelStats,
  createMentorPanelSlot,
  deleteMentorPanelSlot,
} from "../services/mentor-panel.service"

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const profile = await getMentorPanelProfile(req.user.userId)
    return sendSuccess(res, profile)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function getBookings(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const bookings = await getMentorPanelBookings(req.user.userId)
    return sendSuccess(res, bookings)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function getSlots(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const slots = await getMentorPanelSlots(req.user.userId)
    return sendSuccess(res, slots)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function patchBookingNotes(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const schema = z.object({
      sessionNotes: z.string().nullable(),
    })
    const data = schema.parse(req.body)
    const booking = await saveMentorSessionNotes(
      req.user.userId,
      param(req.params.bookingId),
      data.sessionNotes
    )
    return sendSuccess(res, booking)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function patchProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const schema = z.object({
      displayName: z.string().min(1).optional(),
      bio: z.string().nullable().optional(),
      isAvailable: z.boolean().optional(),
    })
    const data = schema.parse(req.body)
    const profile = await updateMentorPanelProfile(req.user.userId, data)
    return sendSuccess(res, profile)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const stats = await getMentorPanelStats(req.user.userId)
    return sendSuccess(res, stats)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function postSlot(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const schema = z.object({
      date: z.string().datetime(),
    })
    const { date } = schema.parse(req.body)
    const slot = await createMentorPanelSlot(req.user.userId, date)
    return sendSuccess(res, slot, 201)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", error.message, 404)
    if (error.code === "INVALID_DATE") return sendError(res, "INVALID_DATE", error.message, 400)
    next(err)
  }
}

export async function removeSlot(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    const result = await deleteMentorPanelSlot(req.user.userId, param(req.params.slotId))
    return sendSuccess(res, result)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", error.message, 404)
    if (error.code === "SLOT_BOOKED") return sendError(res, "SLOT_BOOKED", error.message, 409)
    next(err)
  }
}
