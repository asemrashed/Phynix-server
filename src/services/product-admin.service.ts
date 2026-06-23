import type {
  AdminDigitalProductDetail,
  AdminPhysicalProductDetail,
  DigitalProductType,
} from "@fxprime/types"
import { prisma } from "../lib/prisma"

export async function getAdminDigitalProduct(
  productId: string
): Promise<AdminDigitalProductDetail> {
  const product = await prisma.digitalProduct.findUnique({ where: { id: productId } })
  if (!product) {
    throw Object.assign(new Error("Product not found"), { code: "NOT_FOUND" })
  }

  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description,
    type: product.type as DigitalProductType,
    thumbnailUrl: product.thumbnailUrl,
    fileKey: product.fileKey,
    fileSize: product.fileSize,
    price: Number(product.price),
    currency: product.currency,
    maxDownloads: product.maxDownloads,
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
  }
}

export async function getAdminPhysicalProduct(
  productId: string
): Promise<AdminPhysicalProductDetail> {
  const product = await prisma.physicalProduct.findUnique({ where: { id: productId } })
  if (!product) {
    throw Object.assign(new Error("Product not found"), { code: "NOT_FOUND" })
  }

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: Number(product.price),
    currency: product.currency,
    stock: product.stock,
    images: product.images,
    weight: product.weight ? Number(product.weight) : null,
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
  }
}

export async function createDigitalProduct(data: {
  title: string
  slug: string
  description?: string
  type: DigitalProductType
  thumbnailUrl?: string
  fileKey: string
  fileSize: number
  price: number
  currency?: string
  maxDownloads?: number
  isActive?: boolean
}) {
  const existing = await prisma.digitalProduct.findUnique({ where: { slug: data.slug } })
  if (existing) {
    throw Object.assign(new Error("Slug already exists"), { code: "SLUG_EXISTS" })
  }

  const product = await prisma.digitalProduct.create({
    data: {
      title: data.title,
      slug: data.slug,
      description: data.description,
      type: data.type,
      thumbnailUrl: data.thumbnailUrl,
      fileKey: data.fileKey,
      fileSize: data.fileSize,
      price: data.price,
      currency: data.currency || "BDT",
      maxDownloads: data.maxDownloads ?? 10,
      isActive: data.isActive ?? false,
    },
  })

  return getAdminDigitalProduct(product.id)
}

export async function updateDigitalProduct(
  productId: string,
  data: {
    title?: string
    slug?: string
    description?: string | null
    type?: DigitalProductType
    thumbnailUrl?: string | null
    fileKey?: string
    fileSize?: number
    price?: number
    currency?: string
    maxDownloads?: number
    isActive?: boolean
  }
) {
  const product = await prisma.digitalProduct.findUnique({ where: { id: productId } })
  if (!product) {
    throw Object.assign(new Error("Product not found"), { code: "NOT_FOUND" })
  }

  if (data.slug && data.slug !== product.slug) {
    const existing = await prisma.digitalProduct.findUnique({ where: { slug: data.slug } })
    if (existing) {
      throw Object.assign(new Error("Slug already exists"), { code: "SLUG_EXISTS" })
    }
  }

  await prisma.digitalProduct.update({
    where: { id: productId },
    data,
  })

  return getAdminDigitalProduct(productId)
}

export async function createPhysicalProduct(data: {
  name: string
  slug: string
  description?: string
  price: number
  currency?: string
  stock: number
  images?: string[]
  weight?: number
  isActive?: boolean
}) {
  const existing = await prisma.physicalProduct.findUnique({ where: { slug: data.slug } })
  if (existing) {
    throw Object.assign(new Error("Slug already exists"), { code: "SLUG_EXISTS" })
  }

  const product = await prisma.physicalProduct.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      price: data.price,
      currency: data.currency || "BDT",
      stock: data.stock,
      images: data.images ?? [],
      weight: data.weight,
      isActive: data.isActive ?? false,
    },
  })

  return getAdminPhysicalProduct(product.id)
}

export async function updatePhysicalProduct(
  productId: string,
  data: {
    name?: string
    slug?: string
    description?: string | null
    price?: number
    currency?: string
    stock?: number
    images?: string[]
    weight?: number | null
    isActive?: boolean
  }
) {
  const product = await prisma.physicalProduct.findUnique({ where: { id: productId } })
  if (!product) {
    throw Object.assign(new Error("Product not found"), { code: "NOT_FOUND" })
  }

  if (data.slug && data.slug !== product.slug) {
    const existing = await prisma.physicalProduct.findUnique({ where: { slug: data.slug } })
    if (existing) {
      throw Object.assign(new Error("Slug already exists"), { code: "SLUG_EXISTS" })
    }
  }

  await prisma.physicalProduct.update({
    where: { id: productId },
    data,
  })

  return getAdminPhysicalProduct(productId)
}
