import { Request, Response, NextFunction } from "express"
import { listBlogPosts, getBlogPost, listCategories } from "../services/blog.service"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"
import { getStudentId } from "../lib/student"

export async function getPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listBlogPosts({
      category: req.query.category as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 10,
    })
    return sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export async function getPost(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = param(req.params.slug)
    const studentId = req.user ? await getStudentId(req.user.userId) : null
    const post = await getBlogPost(slug, {
      studentId,
      role: req.user?.role,
    })
    if (!post) return sendError(res, "NOT_FOUND", "Post not found", 404)
    return sendSuccess(res, post)
  } catch (err) {
    next(err)
  }
}

export async function getCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await listCategories()
    return sendSuccess(res, categories)
  } catch (err) {
    next(err)
  }
}
