import path from "path"
import { v4 as uuid } from "uuid"
import sharp from "sharp"
import fs from "fs"
import { getStorageProvider, getUploadPublicUrl } from "../lib/storage"

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_DIGITAL_BYTES = 50 * 1024 * 1024
const MAX_VIDEO_BYTES = 500 * 1024 * 1024

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
])

const ALLOWED_VIDEO_EXTS = [".mp4", ".webm", ".mov"]
const MAX_IMAGE_DIMENSION = 1920

const ALLOWED_DIGITAL_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/octet-stream",
])

export { getUploadPublicUrl }

async function compressImage(buffer: Buffer, mimetype: string): Promise<{ buffer: Buffer; mimetype: string }> {
  const image = sharp(buffer).rotate().resize({
    width: MAX_IMAGE_DIMENSION,
    height: MAX_IMAGE_DIMENSION,
    fit: "inside",
    withoutEnlargement: true,
  })

  if (mimetype === "image/png" || mimetype === "image/gif") {
    const output = await image.png({ compressionLevel: 8 }).toBuffer()
    return { buffer: output, mimetype: "image/png" }
  }

  const output = await image.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  return { buffer: output, mimetype: "image/jpeg" }
}

export async function saveImageUpload(
  buffer: Buffer,
  mimetype: string,
  originalName: string,
  subdir: string
): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(mimetype)) {
    throw Object.assign(new Error("Invalid image type"), { code: "INVALID_FILE_TYPE" })
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error("File too large (max 5MB)"), { code: "FILE_TOO_LARGE" })
  }

  const compressed = await compressImage(buffer, mimetype)
  const ext =
    compressed.mimetype === "image/png"
      ? ".png"
      : compressed.mimetype === "image/webp"
        ? ".webp"
        : ".jpg"
  const filename = `${uuid()}${ext}`

  const stored = await getStorageProvider().save({
    buffer: compressed.buffer,
    filename,
    subdir,
    contentType: compressed.mimetype,
  })

  return stored.publicPath
}

export async function saveDigitalFileUpload(
  buffer: Buffer,
  mimetype: string,
  originalName: string
): Promise<{ fileKey: string; fileSize: number }> {
  const ext = path.extname(originalName).toLowerCase()
  const allowedExts = [".pdf", ".zip", ".xlsx", ".xls", ".txt", ".ex4", ".mq4", ".tpl"]
  const safeExt = allowedExts.includes(ext) ? ext : ".bin"

  if (!ALLOWED_DIGITAL_TYPES.has(mimetype) && !allowedExts.includes(ext)) {
    throw Object.assign(new Error("Invalid file type"), { code: "INVALID_FILE_TYPE" })
  }

  if (buffer.length > MAX_DIGITAL_BYTES) {
    throw Object.assign(new Error("File too large (max 50MB)"), { code: "FILE_TOO_LARGE" })
  }

  const filename = `${uuid()}${safeExt}`
  const stored = await getStorageProvider().save({
    buffer,
    filename,
    subdir: "digital",
    contentType: mimetype,
  })

  const fileKey = path.basename(stored.publicPath)
  return { fileKey, fileSize: stored.size }
}

export async function saveCourseVideoUpload(
  tempFilePath: string,
  originalName: string,
  courseId: string,
  lessonId: string
): Promise<{ videoRef: string; size: number }> {
  const ext = path.extname(originalName).toLowerCase()
  const safeExt = ALLOWED_VIDEO_EXTS.includes(ext) ? ext : ".mp4"
  const storageKey = `videos/${courseId}/${lessonId}${safeExt}`
  const destDir = path.join(process.cwd(), "uploads", "videos", courseId)
  const destPath = path.join(destDir, `${lessonId}${safeExt}`)

  fs.mkdirSync(destDir, { recursive: true })

  const stat = fs.statSync(tempFilePath)
  if (stat.size > MAX_VIDEO_BYTES) {
    fs.unlinkSync(tempFilePath)
    throw Object.assign(new Error("Video too large (max 500MB)"), { code: "FILE_TOO_LARGE" })
  }

  fs.renameSync(tempFilePath, destPath)

  // Remove alternate extensions for same lesson
  for (const altExt of ALLOWED_VIDEO_EXTS) {
    if (altExt === safeExt) continue
    const altPath = path.join(destDir, `${lessonId}${altExt}`)
    if (fs.existsSync(altPath)) fs.unlinkSync(altPath)
  }

  return { videoRef: storageKey, size: stat.size }
}
