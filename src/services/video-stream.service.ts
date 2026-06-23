import fs from "fs"
import path from "path"
import type { Response } from "express"
import { getVideoMimeType } from "../lib/video-source"

const UPLOAD_ROOT = path.join(process.cwd(), "uploads")

export function streamLessonVideoFile(
  res: Response,
  storageKey: string,
  rangeHeader?: string
) {
  const filePath = path.join(UPLOAD_ROOT, storageKey)

  if (!fs.existsSync(filePath)) {
    throw Object.assign(new Error("Video file not found"), { code: "NOT_FOUND" })
  }

  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const contentType = getVideoMimeType(storageKey)

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-")
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

    if (Number.isNaN(start) || start >= fileSize) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`)
      res.end()
      return
    }

    const chunkSize = end - start + 1
    const stream = fs.createReadStream(filePath, { start, end })

    res.status(206)
    res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`)
    res.setHeader("Accept-Ranges", "bytes")
    res.setHeader("Content-Length", chunkSize)
    res.setHeader("Content-Type", contentType)
    stream.pipe(res)
    return
  }

  res.status(200)
  res.setHeader("Content-Length", fileSize)
  res.setHeader("Content-Type", contentType)
  res.setHeader("Accept-Ranges", "bytes")
  fs.createReadStream(filePath).pipe(res)
}
