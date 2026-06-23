import type { BookmarkItem, WishlistItem } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { resolveEntitiesBatch } from "../lib/entity-resolver"

function entityKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`
}

async function enrichRows<T extends BookmarkItem | WishlistItem>(
  rows: { id: string; entityType: string; entityId: string; createdAt: Date }[],
  includePrice: boolean
): Promise<T[]> {
  const metaMap = await resolveEntitiesBatch(rows)
  return rows.map((row) => {
    const meta = metaMap.get(entityKey(row.entityType, row.entityId))!
    const base = {
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      createdAt: row.createdAt.toISOString(),
      title: meta.title,
      subtitle: meta.subtitle,
      href: meta.href,
      thumbnailUrl: meta.thumbnailUrl,
    }
    if (includePrice) {
      return { ...base, price: meta.price, currency: meta.currency } as T
    }
    return base as T
  })
}

export async function getBookmarks(
  userId: string,
  entityType?: string
): Promise<BookmarkItem[]> {
  const where: Record<string, unknown> = { userId }
  if (entityType) where.entityType = entityType

  const rows = await prisma.bookmark.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  return enrichRows<BookmarkItem>(rows, false)
}

export async function addBookmark(userId: string, entityType: string, entityId: string) {
  const row = await prisma.bookmark.upsert({
    where: { userId_entityType_entityId: { userId, entityType, entityId } },
    create: { userId, entityType, entityId },
    update: {},
  })
  const [item] = await enrichRows<BookmarkItem>([row], false)
  return item
}

export async function removeBookmark(userId: string, bookmarkId: string) {
  await prisma.bookmark.deleteMany({ where: { id: bookmarkId, userId } })
}

export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
  return enrichRows<WishlistItem>(rows, true)
}

export async function addWishlist(userId: string, entityType: string, entityId: string) {
  const row = await prisma.wishlistItem.upsert({
    where: { userId_entityType_entityId: { userId, entityType, entityId } },
    create: { userId, entityType, entityId },
    update: {},
  })
  const [item] = await enrichRows<WishlistItem>([row], true)
  return item
}

export async function removeWishlist(userId: string, itemId: string) {
  await prisma.wishlistItem.deleteMany({ where: { id: itemId, userId } })
}

export async function getSaveStatus(
  userId: string,
  entityType: string,
  entityId: string
) {
  const [bookmark, wishlist] = await Promise.all([
    prisma.bookmark.findUnique({
      where: { userId_entityType_entityId: { userId, entityType, entityId } },
    }),
    prisma.wishlistItem.findUnique({
      where: { userId_entityType_entityId: { userId, entityType, entityId } },
    }),
  ])

  return {
    bookmarkId: bookmark?.id ?? null,
    wishlistId: wishlist?.id ?? null,
    isBookmarked: !!bookmark,
    isWishlisted: !!wishlist,
  }
}
