import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import { sendSuccess, sendError } from "../lib/response"
import { prisma } from "../lib/prisma"
import { param } from "../lib/params"
import {
  listSavedAddresses,
  createSavedAddress,
  updateSavedAddress,
  deleteSavedAddress,
} from "../services/address.service"

const addressSchema = z.object({
  label: z.string().max(50).optional(),
  name: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export async function getAddresses(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }
    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
    })
    if (!student) {
      return sendError(res, "NOT_FOUND", "Student not found", 404)
    }
    const addresses = await listSavedAddresses(student.id)
    return sendSuccess(res, addresses)
  } catch (err) {
    next(err)
  }
}

export async function postAddress(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }
    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
    })
    if (!student) {
      return sendError(res, "NOT_FOUND", "Student not found", 404)
    }
    const data = addressSchema.parse(req.body)
    const address = await createSavedAddress(student.id, data)
    return sendSuccess(res, address, 201)
  } catch (err) {
    next(err)
  }
}

export async function patchAddress(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }
    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
    })
    if (!student) {
      return sendError(res, "NOT_FOUND", "Student not found", 404)
    }
    const addressId = param(req.params.addressId)
    const data = addressSchema.partial().parse(req.body)
    const address = await updateSavedAddress(student.id, addressId, data)
    return sendSuccess(res, address)
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}

export async function removeAddress(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401)
    }
    const student = await prisma.student.findUnique({
      where: { userId: req.user.userId },
    })
    if (!student) {
      return sendError(res, "NOT_FOUND", "Student not found", 404)
    }
    const addressId = param(req.params.addressId)
    await deleteSavedAddress(student.id, addressId)
    return sendSuccess(res, { deleted: true })
  } catch (err) {
    const error = err as Error & { code?: string }
    if (error.code === "NOT_FOUND") {
      return sendError(res, "NOT_FOUND", error.message, 404)
    }
    next(err)
  }
}
