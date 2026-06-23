import type { SearchResponse, SearchResultItem } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { getCached, setCached } from "../lib/cache"

const MIN_QUERY_LENGTH = 2
const DEFAULT_LIMIT = 12
const SEARCH_CACHE_TTL = 120

function searchCacheKey(query: string, type: string, limit: number): string {
  return `search:${type}:${limit}:${query.toLowerCase()}`
}

function emptyResponse(query: string): SearchResponse {
  return { query, courses: [], blog: [], products: [], total: 0 }
}

export async function globalSearch(
  query: string,
  options?: { type?: "all" | "courses" | "blog" | "products"; limit?: number }
): Promise<SearchResponse> {
  const q = query.trim()
  if (q.length < MIN_QUERY_LENGTH) return emptyResponse(q)

  const limit = options?.limit ?? DEFAULT_LIMIT
  const type = options?.type ?? "all"
  const cacheKey = searchCacheKey(q, type, limit)
  const cached = await getCached<SearchResponse>(cacheKey)
  if (cached) return cached

  const now = new Date()

  const textMatch = (fields: Record<string, unknown>[]) => ({ OR: fields })

  const publishedBlogFilter = {
    status: "PUBLISHED" as const,
    AND: [
      { OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] },
      textMatch([
        { title: { contains: q, mode: "insensitive" } },
        { excerpt: { contains: q, mode: "insensitive" } },
      ]),
    ],
  }

  const [courses, blog, digital, physical] = await Promise.all([
    type === "all" || type === "courses"
      ? prisma.course.findMany({
          where: {
            status: "PUBLISHED",
            ...textMatch([
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ]),
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            thumbnailUrl: true,
            price: true,
            currency: true,
            level: true,
          },
        })
      : Promise.resolve([]),

    type === "all" || type === "blog"
      ? prisma.blogPost.findMany({
          where: publishedBlogFilter,
          include: { category: true },
          orderBy: { publishedAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),

    type === "all" || type === "products"
      ? prisma.digitalProduct.findMany({
          where: {
            isActive: true,
            ...textMatch([
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ]),
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),

    type === "all" || type === "products"
      ? prisma.physicalProduct.findMany({
          where: {
            isActive: true,
            ...textMatch([
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ]),
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
  ])

  const courseResults: SearchResultItem[] = courses.map((c) => ({
    id: c.id,
    type: "course",
    title: c.title,
    subtitle: c.level,
    description: c.description,
    href: `/courses/${c.slug}`,
    thumbnailUrl: c.thumbnailUrl,
    price: Number(c.price),
    currency: c.currency,
  }))

  const blogResults: SearchResultItem[] = blog.map((p) => ({
    id: p.id,
    type: "blog",
    title: p.title,
    subtitle: p.category.name,
    description: p.excerpt,
    href: `/blog/${p.slug}`,
    thumbnailUrl: p.coverUrl,
  }))

  const productResults: SearchResultItem[] = [
    ...digital.map((p) => ({
      id: p.id,
      type: "product" as const,
      title: p.title,
      subtitle: p.type.replace(/_/g, " "),
      description: p.description,
      href: `/marketplace/digital/${p.slug}`,
      thumbnailUrl: p.thumbnailUrl,
      price: Number(p.price),
      currency: p.currency,
      productType: "digital" as const,
    })),
    ...physical.map((p) => ({
      id: p.id,
      type: "product" as const,
      title: p.name,
      subtitle: "Physical",
      description: p.description,
      href: `/marketplace/physical/${p.slug}`,
      thumbnailUrl: p.images[0] ?? null,
      price: Number(p.price),
      currency: p.currency,
      productType: "physical" as const,
    })),
  ]

  const response = {
    query: q,
    courses: courseResults,
    blog: blogResults,
    products: productResults,
    total: courseResults.length + blogResults.length + productResults.length,
  }

  await setCached(cacheKey, response, SEARCH_CACHE_TTL)
  return response
}
