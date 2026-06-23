import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  listCommunityPosts,
  getCommunityPost,
  createCommunityPost,
  createCommunityReply,
  updateCommunityPost,
  deleteCommunityPost,
  toggleCommunityPostLike,
  setCommunityReaction,
  reportCommunityPost,
} from "../services/community.service"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"

function viewerId(req: Request) {
  return req.user?.userId
}

export async function getPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const page = req.query.page ? Number(req.query.page) : 1
    const limit = req.query.limit ? Number(req.query.limit) : 20
    const result = await listCommunityPosts(page, limit, viewerId(req))
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function getPost(req: Request, res: Response, next: NextFunction) {
  try {
    const postId = param(req.params.postId)
    const result = await getCommunityPost(postId, viewerId(req))
    return sendSuccess(res, result)
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", "Post not found", 404)
    next(err)
  }
}

const postSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10).max(5000),
})

export async function createPost(req: Request, res: Response, next: NextFunction) {
  try {
    const body = postSchema.parse(req.body)
    const post = await createCommunityPost(req.user!.userId, body.title, body.content)
    return sendSuccess(res, post, 201)
  } catch (err) {
    next(err)
  }
}

const replySchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().uuid().optional(),
})

export async function createReply(req: Request, res: Response, next: NextFunction) {
  try {
    const postId = param(req.params.postId)
    const body = replySchema.parse(req.body)
    const reply = await createCommunityReply(
      req.user!.userId,
      postId,
      body.content,
      body.parentId
    )
    return sendSuccess(res, reply, 201)
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", "Post not found", 404)
    next(err)
  }
}

const updateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  content: z.string().min(10).max(5000).optional(),
})

export async function updatePost(req: Request, res: Response, next: NextFunction) {
  try {
    const postId = param(req.params.postId)
    const body = updateSchema.parse(req.body)
    const post = await updateCommunityPost(req.user!.userId, postId, body)
    return sendSuccess(res, post)
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", e.message!, 404)
    if (e.code === "FORBIDDEN") return sendError(res, "FORBIDDEN", e.message!, 403)
    next(err)
  }
}

export async function removePost(req: Request, res: Response, next: NextFunction) {
  try {
    const postId = param(req.params.postId)
    const result = await deleteCommunityPost(req.user!.userId, postId)
    return sendSuccess(res, result)
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", e.message!, 404)
    if (e.code === "FORBIDDEN") return sendError(res, "FORBIDDEN", e.message!, 403)
    next(err)
  }
}

export async function likePost(req: Request, res: Response, next: NextFunction) {
  try {
    const postId = param(req.params.postId)
    const result = await toggleCommunityPostLike(req.user!.userId, postId)
    return sendSuccess(res, result)
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", "Post not found", 404)
    next(err)
  }
}

const reactionSchema = z.object({
  type: z.enum(["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY"]),
})

export async function reactToPost(req: Request, res: Response, next: NextFunction) {
  try {
    const postId = param(req.params.postId)
    const body = reactionSchema.parse(req.body)
    const result = await setCommunityReaction(req.user!.userId, postId, body.type)
    return sendSuccess(res, result)
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", "Post not found", 404)
    next(err)
  }
}

export async function reportPost(req: Request, res: Response, next: NextFunction) {
  try {
    const postId = param(req.params.postId)
    const body = z.object({ reason: z.string().max(500).optional() }).parse(req.body)
    const result = await reportCommunityPost(req.user!.userId, postId, body.reason)
    return sendSuccess(res, result)
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === "NOT_FOUND") return sendError(res, "NOT_FOUND", "Post not found", 404)
    next(err)
  }
}
