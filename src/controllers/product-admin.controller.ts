import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  getAdminDigitalProduct,
  getAdminPhysicalProduct,
  createDigitalProduct,
  updateDigitalProduct,
  createPhysicalProduct,
  updatePhysicalProduct,
} from "../services/product-admin.service"
import {
  getUploadPublicUrl,
  saveDigitalFileUpload,
  saveImageUpload,
} from "../services/upload.service"
import { sendSuccess, sendError } from "../lib/response"
import { param } from "../lib/params"

const digitalType = z.enum([
  "PDF",
  "EBOOK",
  "TRADING_JOURNAL",
  "TEMPLATE",
  "INDICATOR",
  "TOOL",
  "BUNDLE",
])

const createDigitalSchema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  type: digitalType,
  thumbnailUrl: z.string().optional(),
  fileKey: z.string().min(1),
  fileSize: z.number().int().positive(),
  price: z.number().min(0),
  currency: z.string().optional(),
  maxDownloads: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
})

const patchDigitalSchema = createDigitalSchema
  .partial()
  .extend({
    description: z.string().nullable().optional(),
    thumbnailUrl: z.string().nullable().optional(),
  })

const createPhysicalSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  price: z.number().min(0),
  currency: z.string().optional(),
  stock: z.number().int().min(0),
  images: z.array(z.string()).optional(),
  weight: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
})

const patchPhysicalSchema = createPhysicalSchema.partial().extend({
  description: z.string().nullable().optional(),
  weight: z.number().min(0).nullable().optional(),
})

function handleProductError(err: unknown, res: Response, next: NextFunction) {
  const code = (err as { code?: string }).code
  if (code === "NOT_FOUND") return sendError(res, code, (err as Error).message, 404)
  if (code === "SLUG_EXISTS" || code === "INVALID_FILE_TYPE" || code === "FILE_TOO_LARGE") {
    return sendError(res, code, (err as Error).message, 400)
  }
  return next(err)
}

export async function getDigitalProductDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await getAdminDigitalProduct(param(req.params.productId))
    return sendSuccess(res, product)
  } catch (err) {
    return handleProductError(err, res, next)
  }
}

export async function postDigitalProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createDigitalSchema.parse(req.body)
    const product = await createDigitalProduct(data)
    return sendSuccess(res, product, 201)
  } catch (err) {
    return handleProductError(err, res, next)
  }
}

export async function patchDigitalProductDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const data = patchDigitalSchema.parse(req.body)
    const product = await updateDigitalProduct(param(req.params.productId), data)
    return sendSuccess(res, product)
  } catch (err) {
    return handleProductError(err, res, next)
  }
}

export async function getPhysicalProductDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await getAdminPhysicalProduct(param(req.params.productId))
    return sendSuccess(res, product)
  } catch (err) {
    return handleProductError(err, res, next)
  }
}

export async function postPhysicalProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createPhysicalSchema.parse(req.body)
    const product = await createPhysicalProduct(data)
    return sendSuccess(res, product, 201)
  } catch (err) {
    return handleProductError(err, res, next)
  }
}

export async function patchPhysicalProductDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const data = patchPhysicalSchema.parse(req.body)
    const product = await updatePhysicalProduct(param(req.params.productId), data)
    return sendSuccess(res, product)
  } catch (err) {
    return handleProductError(err, res, next)
  }
}

export async function uploadDigitalFile(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file
    if (!file) {
      return sendError(res, "NO_FILE", "No file uploaded", 400)
    }

    const result = await saveDigitalFileUpload(file.buffer, file.mimetype, file.originalname)
    return sendSuccess(res, result)
  } catch (err) {
    return handleProductError(err, res, next)
  }
}

export async function uploadProductImages(req: Request, res: Response, next: NextFunction) {
  try {
    const files = req.files as Express.Multer.File[] | undefined
    if (!files?.length) {
      return sendError(res, "NO_FILE", "No files uploaded", 400)
    }

    const urls = await Promise.all(
      files.map(async (file) => {
        const relativePath = await saveImageUpload(
          file.buffer,
          file.mimetype,
          file.originalname,
          "product-images"
        )
        return getUploadPublicUrl(relativePath)
      })
    )

    return sendSuccess(res, { urls })
  } catch (err) {
    return handleProductError(err, res, next)
  }
}
