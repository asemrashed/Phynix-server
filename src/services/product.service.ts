import type {
  MarketplaceCatalog,
  MarketplaceFilters,
  MarketplaceProductDetail,
  MarketplaceProductItem,
} from "@fxprime/types"
import { prisma } from "../lib/prisma"
import path from "path"
import fs from "fs"

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "digital")

function decodeMarketplaceCursor(cursor?: string): number {
  if (!cursor) return 0
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      offset?: number
    }
    return typeof parsed.offset === "number" && parsed.offset >= 0 ? parsed.offset : 0
  } catch {
    return 0
  }
}

function encodeMarketplaceCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString("base64url")
}

export async function listDigitalProducts(studentId?: string) {
  const products = await prisma.digitalProduct.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  })

  let purchasedIds = new Set<string>()
  if (studentId) {
    const purchases = await prisma.productPurchase.findMany({
      where: { studentId },
      select: { productId: true },
    })
    purchasedIds = new Set(purchases.map((p) => p.productId))
  }

  return products.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description,
    type: p.type,
    thumbnailUrl: p.thumbnailUrl,
    price: Number(p.price),
    currency: p.currency,
    fileSize: p.fileSize,
    isPurchased: purchasedIds.has(p.id),
  }))
}

export async function purchaseDigitalProduct(
  studentId: string,
  productId: string,
  paymentRef?: string
) {
  const product = await prisma.digitalProduct.findUnique({ where: { id: productId } })
  if (!product || !product.isActive) {
    throw Object.assign(new Error("Product not found"), { code: "NOT_FOUND" })
  }

  const existing = await prisma.productPurchase.findUnique({
    where: { studentId_productId: { studentId, productId } },
  })
  if (existing) {
    throw Object.assign(new Error("Already purchased"), { code: "ALREADY_PURCHASED" })
  }

  if (Number(product.price) > 0 && !paymentRef) {
    throw Object.assign(new Error("Payment required"), { code: "PAYMENT_REQUIRED" })
  }

  return prisma.productPurchase.create({
    data: { studentId, productId, paymentRef },
  })
}

export async function getDigitalDownload(studentId: string, productId: string) {
  const purchase = await prisma.productPurchase.findUnique({
    where: { studentId_productId: { studentId, productId } },
    include: { product: true },
  })

  if (!purchase) {
    throw Object.assign(new Error("Not purchased"), { code: "NOT_PURCHASED" })
  }

  if (purchase.downloadCount >= purchase.product.maxDownloads) {
    throw Object.assign(new Error("Download limit reached"), { code: "LIMIT_REACHED" })
  }

  const filepath = path.join(UPLOADS_DIR, purchase.product.fileKey)
  if (!fs.existsSync(filepath)) {
    throw Object.assign(new Error("File not found"), { code: "FILE_NOT_FOUND" })
  }

  await prisma.productPurchase.update({
    where: { id: purchase.id },
    data: { downloadCount: { increment: 1 } },
  })

  return { filepath, filename: purchase.product.fileKey, product: purchase.product }
}

export async function getStudentPurchases(studentId: string) {
  const purchases = await prisma.productPurchase.findMany({
    where: { studentId },
    include: { product: true },
    orderBy: { purchasedAt: "desc" },
  })

  return purchases.map((p) => ({
    id: p.id,
    productId: p.productId,
    title: p.product.title,
    type: p.product.type,
    fileSize: p.product.fileSize,
    purchasedAt: p.purchasedAt.toISOString(),
    downloadCount: p.downloadCount,
    maxDownloads: p.product.maxDownloads,
  }))
}

export async function listMarketplace(
  filters: MarketplaceFilters,
  studentId?: string
): Promise<MarketplaceCatalog> {
  let purchasedIds = new Set<string>()
  if (studentId) {
    const purchases = await prisma.productPurchase.findMany({
      where: { studentId },
      select: { productId: true },
    })
    purchasedIds = new Set(purchases.map((p) => p.productId))
  }

  const type = filters.free ? "digital" : (filters.type ?? "all")
  const items: MarketplaceProductItem[] = []

  if (type === "all" || type === "digital") {
    const digitalWhere: Record<string, unknown> = { isActive: true }
    if (filters.category) digitalWhere.type = filters.category
    if (filters.free) {
      digitalWhere.price = 0
    } else if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      digitalWhere.price = {}
      if (filters.minPrice !== undefined) {
        (digitalWhere.price as Record<string, number>).gte = filters.minPrice
      }
      if (filters.maxPrice !== undefined) {
        (digitalWhere.price as Record<string, number>).lte = filters.maxPrice
      }
    }

    const digital = await prisma.digitalProduct.findMany({
      where: digitalWhere,
      orderBy: { createdAt: "desc" },
    })

    for (const p of digital) {
      items.push({
        id: p.id,
        slug: p.slug,
        title: p.title,
        description: p.description,
        price: Number(p.price),
        currency: p.currency,
        thumbnailUrl: p.thumbnailUrl,
        productType: "digital",
        category: p.type,
        isPurchased: purchasedIds.has(p.id),
      })
    }
  }

  if (!filters.free && (type === "all" || type === "physical")) {
    const physicalWhere: Record<string, unknown> = { isActive: true }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      physicalWhere.price = {}
      if (filters.minPrice !== undefined) {
        (physicalWhere.price as Record<string, number>).gte = filters.minPrice
      }
      if (filters.maxPrice !== undefined) {
        (physicalWhere.price as Record<string, number>).lte = filters.maxPrice
      }
    }

    const physical = await prisma.physicalProduct.findMany({
      where: physicalWhere,
      orderBy: { createdAt: "desc" },
    })

    for (const p of physical) {
      items.push({
        id: p.id,
        slug: p.slug,
        title: p.name,
        description: p.description,
        price: Number(p.price),
        currency: p.currency,
        thumbnailUrl: p.images[0] ?? null,
        productType: "physical",
        category: "PHYSICAL",
        stock: p.stock,
      })
    }
  }

  const sort = filters.sort ?? "newest"
  items.sort((a, b) => {
    if (sort === "price_asc") return a.price - b.price
    if (sort === "price_desc") return b.price - a.price
    return 0
  })

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase()
    const filtered = items.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false)
    )
    items.length = 0
    items.push(...filtered)
  }

  const categories = [
    ...new Set(
      items.map((i) => i.category).filter((c): c is string => Boolean(c))
    ),
  ].sort()

  const limit = Math.min(48, Math.max(1, filters.limit ?? 24))
  const offset = decodeMarketplaceCursor(filters.cursor)
  const page = items.slice(offset, offset + limit)

  return {
    products: page,
    total: items.length,
    categories,
    nextCursor: offset + limit < items.length ? encodeMarketplaceCursor(offset + limit) : null,
    hasMore: offset + limit < items.length,
  }
}

export async function getDigitalProductBySlug(
  slug: string,
  studentId?: string
): Promise<MarketplaceProductDetail | null> {
  const product = await prisma.digitalProduct.findFirst({
    where: { slug, isActive: true },
  })
  if (!product) return null

  let isPurchased = false
  if (studentId) {
    const purchase = await prisma.productPurchase.findUnique({
      where: { studentId_productId: { studentId, productId: product.id } },
    })
    isPurchased = !!purchase
  }

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    price: Number(product.price),
    currency: product.currency,
    thumbnailUrl: product.thumbnailUrl,
    productType: "digital",
    category: product.type,
    fileSize: product.fileSize,
    isPurchased,
    images: product.thumbnailUrl ? [product.thumbnailUrl] : [],
  }
}

export async function getPhysicalProductBySlug(
  slug: string
): Promise<MarketplaceProductDetail | null> {
  const product = await prisma.physicalProduct.findFirst({
    where: { slug, isActive: true },
  })
  if (!product) return null

  return {
    id: product.id,
    slug: product.slug,
    title: product.name,
    description: product.description,
    price: Number(product.price),
    currency: product.currency,
    thumbnailUrl: product.images[0] ?? null,
    productType: "physical",
    category: "PHYSICAL",
    stock: product.stock,
    images: product.images,
  }
}

export async function getPhysicalProductById(id: string) {
  const product = await prisma.physicalProduct.findFirst({
    where: { id, isActive: true },
  })
  if (!product) return null

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: Number(product.price),
    currency: product.currency,
    stock: product.stock,
    images: product.images,
  }
}

export async function listPhysicalProducts() {
  const products = await prisma.physicalProduct.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  })

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: Number(p.price),
    currency: p.currency,
    stock: p.stock,
    images: p.images,
  }))
}

async function generateOrderCode(): Promise<string> {
  const counter = await prisma.orderIdCounter.update({
    where: { id: "global" },
    data: { count: { increment: 1 } },
  })
  return `FXP-${String(counter.count).padStart(6, "0")}`
}

export async function createPhysicalOrder(
  studentId: string,
  items: { productId: string; quantity: number }[],
  shippingAddress: Record<string, string>,
  paymentRef?: string
) {
  if (!items.length) {
    throw Object.assign(new Error("No items in order"), { code: "EMPTY_ORDER" })
  }

  const productIds = items.map((i) => i.productId)
  const products = await prisma.physicalProduct.findMany({
    where: { id: { in: productIds }, isActive: true },
  })

  if (products.length !== productIds.length) {
    throw Object.assign(new Error("Product not found"), { code: "NOT_FOUND" })
  }

  const productMap = new Map(products.map((p) => [p.id, p]))
  let subtotal = 0

  for (const item of items) {
    const product = productMap.get(item.productId)!
    if (product.stock < item.quantity) {
      throw Object.assign(new Error(`Insufficient stock for ${product.name}`), {
        code: "OUT_OF_STOCK",
      })
    }
    subtotal += Number(product.price) * item.quantity
  }

  const shippingFee = subtotal >= 1000 ? 0 : 80
  const total = subtotal + shippingFee
  const orderCode = await generateOrderCode()

  const order = await prisma.$transaction(async (tx) => {
    for (const item of items) {
      await tx.physicalProduct.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      })
    }

    return tx.order.create({
      data: {
        orderCode,
        studentId,
        subtotal,
        shippingFee,
        total,
        currency: "BDT",
        shippingAddress,
        paymentRef,
        status: paymentRef ? "PAYMENT_CONFIRMED" : "PENDING",
        items: {
          create: items.map((item) => {
            const product = productMap.get(item.productId)!
            return {
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: product.price,
            }
          }),
        },
      },
      include: { items: { include: { product: true } } },
    })
  })

  return {
    id: order.id,
    orderCode: order.orderCode,
    status: order.status,
    total: Number(order.total),
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({
      name: i.product.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
    })),
  }
}

export async function getStudentOrders(studentId: string) {
  const orders = await prisma.order.findMany({
    where: { studentId },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  })

  return orders.map((o) => ({
    id: o.id,
    orderCode: o.orderCode,
    status: o.status,
    subtotal: Number(o.subtotal),
    shippingFee: Number(o.shippingFee),
    total: Number(o.total),
    currency: o.currency,
    shippingAddress: (() => {
      const raw = o.shippingAddress as Record<string, string> | null
      return {
        name: raw?.name ?? "",
        phone: raw?.phone ?? "",
        address: raw?.address ?? "",
        city: raw?.city ?? "",
        district: raw?.district ?? "",
        postalCode: raw?.postalCode ?? "",
      }
    })(),
    trackingNumber: o.trackingNumber,
    shippedAt: o.shippedAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      name: i.product.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
    })),
  }))
}
