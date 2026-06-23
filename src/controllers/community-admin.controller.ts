import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  listAdminCommunityPosts,
  getAdminCommunityPost,
  listAdminCommunityPostReports,
  createAdminCommunityPost,
  moderateCommunityPost,
  type AdminCommunityFilter,
} from "../services/community.service"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"
import { parsePagination } from "../lib/pagination"

const filterSchema = z.enum(["all", "reported", "hidden", "deleted"])

function parseFilter(value: unknown): AdminCommunityFilter {
  const parsed = filterSchema.safeParse(value)
  return parsed.success ? parsed.data : "all"
}

export async function getAdminPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query)
    const filter = parseFilter(req.query.filter)
    const search = typeof req.query.search === "string" ? req.query.search : undefined
    const result = await listAdminCommunityPosts(pagination, filter, search)
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function getAdminPostDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const postId = param(req.params.postId)
    const result = await getAdminCommunityPost(postId)
    return sendSuccess(res, result)
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", "Post not found", 404)
    next(err)
  }
}

export async function getAdminPostReports(req: Request, res: Response, next: NextFunction) {
  try {
    const postId = param(req.params.postId)
    const reports = await listAdminCommunityPostReports(postId)
    return sendSuccess(res, reports)
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", "Post not found", 404)
    next(err)
  }
}

export async function createAdminPost(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z
      .object({
        title: z.string().min(3).max(200),
        content: z.string().min(10).max(5000),
        isPinned: z.boolean().optional(),
        isHidden: z.boolean().optional(),
      })
      .parse(req.body)
    const post = await createAdminCommunityPost(req.user!.userId, body)
    return sendSuccess(res, post, 201)
  } catch (err) {
    next(err)
  }
}

export async function patchAdminPost(req: Request, res: Response, next: NextFunction) {
  try {
    const postId = param(req.params.postId)
    const data = z
      .object({
        title: z.string().min(3).max(200).optional(),
        content: z.string().min(10).max(5000).optional(),
        isHidden: z.boolean().optional(),
        isPinned: z.boolean().optional(),
        isDeleted: z.boolean().optional(),
      })
      .parse(req.body)
    const post = await moderateCommunityPost(postId, data)
    return sendSuccess(res, post)
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", "Post not found", 404)
    next(err)
  }
}
