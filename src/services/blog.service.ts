import type { Role } from "@fxprime/types"
import { prisma } from "../lib/prisma"
import { canAccessPremiumContent } from "./access-control.service"

export async function listBlogPosts(options?: {
  category?: string
  page?: number
  limit?: number
}) {
  const page = options?.page || 1
  const limit = options?.limit || 10
  const skip = (page - 1) * limit

  const now = new Date()
  const where: Record<string, unknown> = {
    status: "PUBLISHED",
    OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
  }
  if (options?.category) {
    where.category = { slug: options.category }
  }

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      include: { category: true },
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.blogPost.count({ where }),
  ])

  return {
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      coverUrl: p.coverUrl,
      category: p.category.name,
      categorySlug: p.category.slug,
      isPremium: p.isPremium,
      publishedAt: p.publishedAt?.toISOString() ?? null,
    })),
    total,
  }
}

export async function getBlogPost(
  slug: string,
  options?: { studentId?: string | null; role?: Role }
) {
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    include: { category: true },
  })

  if (
    !post ||
    post.status !== "PUBLISHED" ||
    (post.publishedAt && post.publishedAt > new Date())
  ) {
    return null
  }

  const hasAccess =
    !post.isPremium ||
    (await canAccessPremiumContent({
      studentId: options?.studentId,
      role: options?.role,
    }))

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: hasAccess ? post.content : null,
    coverUrl: post.coverUrl,
    category: post.category.name,
    categorySlug: post.category.slug,
    isPremium: post.isPremium,
    isGated: post.isPremium && !hasAccess,
    requiredPlan: post.isPremium && !hasAccess ? ("PRO" as const) : null,
    metaTitle: post.metaTitle,
    metaDesc: post.metaDesc,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    relatedPosts: await getRelatedBlogPosts(post.categoryId, post.id),
  }
}

export async function getRelatedBlogPosts(
  categoryId: string,
  excludePostId: string,
  limit = 4
) {
  const now = new Date()
  const posts = await prisma.blogPost.findMany({
    where: {
      id: { not: excludePostId },
      categoryId,
      status: "PUBLISHED",
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    },
    include: { category: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
  })

  return posts.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    coverUrl: p.coverUrl,
    category: p.category.name,
    categorySlug: p.category.slug,
    isPremium: p.isPremium,
    publishedAt: p.publishedAt?.toISOString() ?? null,
  }))
}

export async function listCategories() {
  const categories = await prisma.blogCategory.findMany({
    include: { _count: { select: { posts: true } } },
  })
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    postCount: c._count.posts,
  }))
}
