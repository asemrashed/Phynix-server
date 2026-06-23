import fs from "fs"
import path from "path"
import multer from "multer"
import { v4 as uuid } from "uuid"

export const thumbnailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
})

export const digitalFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
})

export const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
})

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
})

const VIDEO_TMP_DIR = path.join(process.cwd(), "uploads", "videos", "_tmp")

export const courseVideoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(VIDEO_TMP_DIR, { recursive: true })
      cb(null, VIDEO_TMP_DIR)
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".mp4"
      cb(null, `${uuid()}${ext}`)
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["video/mp4", "video/webm", "video/quicktime"])
    if (allowed.has(file.mimetype)) {
      cb(null, true)
      return
    }
    cb(new Error("Invalid video type. Use MP4, WebM, or MOV."))
  },
})
