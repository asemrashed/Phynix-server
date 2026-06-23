import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  getBookmarks,
  addBookmark,
  removeBookmark,
  getWishlist,
  addWishlist,
  removeWishlist,
  getSaveStatus,
} from "../services/bookmark.service"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"

export async function getStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const entityType = req.query.entityType as string
    const entityId = req.query.entityId as string
    if (!entityType || !entityId) {
      return sendError(res, "VALIDATION_ERROR", "entityType and entityId required", 400)
    }
    const status = await getSaveStatus(req.user!.userId, entityType, entityId)
    return sendSuccess(res, status)
  } catch (err) {
    next(err)
  }
}

export async function listBookmarks(req: Request, res: Response, next: NextFunction) {
  try {
    const entityType = req.query.entityType as string | undefined
    const bookmarks = await getBookmarks(req.user!.userId, entityType)
    return sendSuccess(res, bookmarks)
  } catch (err) {
    next(err)
  }
}

const bookmarkSchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
})

export async function createBookmark(req: Request, res: Response, next: NextFunction) {
  try {
    const body = bookmarkSchema.parse(req.body)
    const bookmark = await addBookmark(req.user!.userId, body.entityType, body.entityId)
    return sendSuccess(res, bookmark, 201)
  } catch (err) {
    next(err)
  }
}

export async function deleteBookmark(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req.params.id)
    await removeBookmark(req.user!.userId, id)
    return sendSuccess(res, { deleted: true })
  } catch (err) {
    next(err)
  }
}

export async function listWishlist(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await getWishlist(req.user!.userId)
    return sendSuccess(res, items)
  } catch (err) {
    next(err)
  }
}

export async function createWishlist(req: Request, res: Response, next: NextFunction) {
  try {
    const body = bookmarkSchema.parse(req.body)
    const item = await addWishlist(req.user!.userId, body.entityType, body.entityId)
    return sendSuccess(res, item, 201)
  } catch (err) {
    next(err)
  }
}

export async function deleteWishlist(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req.params.id)
    await removeWishlist(req.user!.userId, id)
    return sendSuccess(res, { deleted: true })
  } catch (err) {
    next(err)
  }
}
