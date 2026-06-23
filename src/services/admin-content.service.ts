import type { AdminBlogCategoryItem, AdminBlogPostDetail } from "@fxprime/types"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { isScheduledPost, resolveBlogPublishState } from "../lib/blog-publish"
import { paginatedResult, type PaginationParams } from "../lib/pagination"

function mapAdminBlogListItem(p: {
  id: string
  title: string
  slug: string
  excerpt: string | null
  coverUrl: string | null
  status: string
  category: { name: string }
  isPremium: boolean
  publishedAt: Date | null
  createdAt: Date
}) {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    coverUrl: p.coverUrl,
    status: p.status,
    category: p.category.name,
    isPremium: p.isPremium,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    isScheduled: isScheduledPost(p.status, p.publishedAt),
    createdAt: p.createdAt.toISOString(),
  }
}

export async function listAdminBlogPosts(
  pagination: PaginationParams,
  filters?: { search?: string; status?: string }
) {
  const { page, pageSize, skip } = pagination
  const where: Prisma.BlogPostWhereInput = {}

  if (filters?.status && filters.status !== "all") {
    where.status = filters.status as "DRAFT" | "PUBLISHED" | "ARCHIVED"
  }

  if (filters?.search) {
    const q = filters.search
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ]
  }

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.blogPost.count({ where }),
  ])

  return paginatedResult(posts.map(mapAdminBlogListItem), total, page, pageSize)
}

export async function getAdminBlogPost(postId: string): Promise<AdminBlogPostDetail> {
  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    include: { category: true },
  })

  if (!post) {
    throw Object.assign(new Error("Post not found"), { code: "NOT_FOUND" })
  }

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    coverUrl: post.coverUrl,
    categoryId: post.categoryId,
    category: post.category.name,
    status: post.status,
    isPremium: post.isPremium,
    metaTitle: post.metaTitle,
    metaDesc: post.metaDesc,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    isScheduled: isScheduledPost(post.status, post.publishedAt),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }
}

export async function createBlogPost(
  authorId: string,
  data: {
    title: string
    slug: string
    excerpt?: string
    content: string
    categoryId: string
    coverUrl?: string
    isPremium?: boolean
    metaTitle?: string
    metaDesc?: string
    status?: "DRAFT" | "PUBLISHED"
    publishedAt?: string | null
    publishNow?: boolean
  }
) {
  const existing = await prisma.blogPost.findUnique({ where: { slug: data.slug } })
  if (existing) {
    throw Object.assign(new Error("Slug already exists"), { code: "SLUG_EXISTS" })
  }

  const category = await prisma.blogCategory.findUnique({ where: { id: data.categoryId } })
  if (!category) {
    throw Object.assign(new Error("Category not found"), { code: "NOT_FOUND" })
  }

  const publish = resolveBlogPublishState({
    status: data.status,
    publishedAt: data.publishedAt,
    publishNow: data.publishNow,
  })

  const post = await prisma.blogPost.create({
    data: {
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      categoryId: data.categoryId,
      coverUrl: data.coverUrl,
      isPremium: data.isPremium ?? false,
      metaTitle: data.metaTitle,
      metaDesc: data.metaDesc,
      authorId,
      status: publish.status,
      publishedAt: publish.publishedAt ?? undefined,
    },
    include: { category: true },
  })

  return getAdminBlogPost(post.id)
}

export async function updateBlogPost(
  postId: string,
  data: {
    title?: string
    slug?: string
    excerpt?: string | null
    content?: string
    categoryId?: string
    coverUrl?: string | null
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"
    isPremium?: boolean
    metaTitle?: string | null
    metaDesc?: string | null
    publishedAt?: string | null
    publishNow?: boolean
  }
) {
  const post = await prisma.blogPost.findUnique({ where: { id: postId } })
  if (!post) {
    throw Object.assign(new Error("Post not found"), { code: "NOT_FOUND" })
  }

  if (data.slug && data.slug !== post.slug) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: data.slug } })
    if (existing) {
      throw Object.assign(new Error("Slug already exists"), { code: "SLUG_EXISTS" })
    }
  }

  if (data.categoryId) {
    const category = await prisma.blogCategory.findUnique({ where: { id: data.categoryId } })
    if (!category) {
      throw Object.assign(new Error("Category not found"), { code: "NOT_FOUND" })
    }
  }

  const publish = resolveBlogPublishState({
    status: data.status ?? (data.publishNow ? "PUBLISHED" : undefined),
    publishedAt: data.publishedAt !== undefined ? data.publishedAt : post.publishedAt,
    publishNow: data.publishNow,
  })

  const hasPublishChange =
    data.status !== undefined || data.publishNow !== undefined || data.publishedAt !== undefined

  await prisma.blogPost.update({
    where: { id: postId },
    data: {
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      categoryId: data.categoryId,
      coverUrl: data.coverUrl,
      isPremium: data.isPremium,
      metaTitle: data.metaTitle,
      metaDesc: data.metaDesc,
      ...(hasPublishChange
        ? {
            status: data.status === "ARCHIVED" ? "ARCHIVED" : publish.status,
            publishedAt:
              data.status === "ARCHIVED"
                ? post.publishedAt
                : publish.publishedAt === undefined
                  ? null
                  : publish.publishedAt,
          }
        : {}),
    },
  })

  return getAdminBlogPost(postId)
}

export async function listAdminDigitalProducts(pagination: PaginationParams) {
  const { page, pageSize, skip } = pagination

  const [products, total] = await Promise.all([
    prisma.digitalProduct.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.digitalProduct.count(),
  ])

  const items = products.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    type: p.type,
    price: Number(p.price),
    currency: p.currency,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  }))

  return paginatedResult(items, total, page, pageSize)
}

export async function listAdminPhysicalProducts(pagination: PaginationParams) {
  const { page, pageSize, skip } = pagination

  const [products, total] = await Promise.all([
    prisma.physicalProduct.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.physicalProduct.count(),
  ])

  const items = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    currency: p.currency,
    stock: p.stock,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  }))

  return paginatedResult(items, total, page, pageSize)
}

export async function updateDigitalProduct(
  productId: string,
  data: { isActive?: boolean; price?: number }
) {
  return prisma.digitalProduct.update({
    where: { id: productId },
    data: {
      isActive: data.isActive,
      price: data.price,
    },
  })
}

export async function updatePhysicalProduct(
  productId: string,
  data: { isActive?: boolean; stock?: number; price?: number }
) {
  return prisma.physicalProduct.update({
    where: { id: productId },
    data: {
      isActive: data.isActive,
      stock: data.stock,
      price: data.price,
    },
  })
}

export async function listBlogCategories(): Promise<AdminBlogCategoryItem[]> {
  const categories = await prisma.blogCategory.findMany({
    include: { _count: { select: { posts: true } } },
    orderBy: { name: "asc" },
  })

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    postCount: c._count.posts,
  }))
}

export async function createBlogCategory(data: { name: string; slug: string }) {
  const existing = await prisma.blogCategory.findFirst({
    where: { OR: [{ name: data.name }, { slug: data.slug }] },
  })
  if (existing) {
    throw Object.assign(new Error("Category name or slug already exists"), { code: "SLUG_EXISTS" })
  }

  const category = await prisma.blogCategory.create({ data })
  return { ...category, postCount: 0 }
}

export async function updateBlogCategory(
  categoryId: string,
  data: { name?: string; slug?: string }
) {
  const category = await prisma.blogCategory.findUnique({ where: { id: categoryId } })
  if (!category) {
    throw Object.assign(new Error("Category not found"), { code: "NOT_FOUND" })
  }

  if (data.slug && data.slug !== category.slug) {
    const existing = await prisma.blogCategory.findUnique({ where: { slug: data.slug } })
    if (existing) {
      throw Object.assign(new Error("Slug already exists"), { code: "SLUG_EXISTS" })
    }
  }

  if (data.name && data.name !== category.name) {
    const existing = await prisma.blogCategory.findUnique({ where: { name: data.name } })
    if (existing) {
      throw Object.assign(new Error("Name already exists"), { code: "SLUG_EXISTS" })
    }
  }

  const updated = await prisma.blogCategory.update({
    where: { id: categoryId },
    data,
    include: { _count: { select: { posts: true } } },
  })

  return {
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    postCount: updated._count.posts,
  }
}

export async function deleteBlogCategory(categoryId: string) {
  const category = await prisma.blogCategory.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { posts: true } } },
  })

  if (!category) {
    throw Object.assign(new Error("Category not found"), { code: "NOT_FOUND" })
  }

  if (category._count.posts > 0) {
    throw Object.assign(new Error("Category has posts and cannot be deleted"), {
      code: "HAS_POSTS",
    })
  }

  await prisma.blogCategory.delete({ where: { id: categoryId } })
  return { deleted: true }
}
