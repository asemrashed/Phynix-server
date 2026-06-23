import { Request, Response, NextFunction } from "express"
import { getPlatformStats } from "../services/stats.service"
import { sendSuccess } from "../lib/response"

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await getPlatformStats()
    return sendSuccess(res, stats)
  } catch (err) {
    next(err)
  }
}
