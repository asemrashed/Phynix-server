import { prisma } from "./prisma"

export interface ResolvedEntity {
  title: string
  subtitle: string | null
  href: string
  thumbnailUrl: string | null
  price?: number
  currency?: string
}

const FALLBACK = (entityType: string): ResolvedEntity => ({
  title: "Unavailable item",
  subtitle: entityType,
  href: "#",
  thumbnailUrl: null,
})

function entityKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`
}

export async function resolveEntity(
  entityType: string,
  entityId: string
): Promise<ResolvedEntity> {
  const map = await resolveEntitiesBatch([{ entityType, entityId }])
  return map.get(entityKey(entityType, entityId)) ?? FALLBACK(entityType)
}

export async function resolveEntitiesBatch(
  rows: { entityType: string; entityId: string }[]
): Promise<Map<string, ResolvedEntity>> {
  const result = new Map<string, ResolvedEntity>()
  if (rows.length === 0) return result

  const byType = new Map<string, Set<string>>()
  for (const row of rows) {
    const ids = byType.get(row.entityType) ?? new Set<string>()
    ids.add(row.entityId)
    byType.set(row.entityType, ids)
  }

  const courseIds = [...(byType.get("COURSE") ?? [])]
  const blogIds = [...(byType.get("BLOG") ?? [])]
  const digitalIds = [...(byType.get("DIGITAL_PRODUCT") ?? [])]
  const physicalIds = [...(byType.get("PHYSICAL_PRODUCT") ?? [])]

  const [courses, blogs, digital, physical] = await Promise.all([
    courseIds.length
      ? prisma.course.findMany({ where: { id: { in: courseIds } } })
      : Promise.resolve([]),
    blogIds.length
      ? prisma.blogPost.findMany({
          where: { id: { in: blogIds } },
          include: { category: true },
        })
      : Promise.resolve([]),
    digitalIds.length
      ? prisma.digitalProduct.findMany({ where: { id: { in: digitalIds } } })
      : Promise.resolve([]),
    physicalIds.length
      ? prisma.physicalProduct.findMany({ where: { id: { in: physicalIds } } })
      : Promise.resolve([]),
  ])

  for (const course of courses) {
    result.set(entityKey("COURSE", course.id), {
      title: course.title,
      subtitle: course.level,
      href: `/courses/${course.slug}`,
      thumbnailUrl: course.thumbnailUrl,
      price: Number(course.price),
      currency: "BDT",
    })
  }

  for (const post of blogs) {
    result.set(entityKey("BLOG", post.id), {
      title: post.title,
      subtitle: post.category?.name ?? "Blog",
      href: `/blog/${post.slug}`,
      thumbnailUrl: post.coverUrl,
    })
  }

  for (const product of digital) {
    result.set(entityKey("DIGITAL_PRODUCT", product.id), {
      title: product.title,
      subtitle: product.type,
      href: `/marketplace/digital/${product.slug}`,
      thumbnailUrl: product.thumbnailUrl,
      price: Number(product.price),
      currency: product.currency,
    })
  }

  for (const product of physical) {
    result.set(entityKey("PHYSICAL_PRODUCT", product.id), {
      title: product.name,
      subtitle: "Physical",
      href: `/marketplace/physical/${product.slug}`,
      thumbnailUrl: product.images[0] ?? null,
      price: Number(product.price),
      currency: product.currency,
    })
  }

  for (const row of rows) {
    const key = entityKey(row.entityType, row.entityId)
    if (!result.has(key)) {
      result.set(key, FALLBACK(row.entityType))
    }
  }

  return result
}
