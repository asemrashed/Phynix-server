import type { CommunityReactionType, Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { sanitizePlainText } from "../lib/sanitize"
import { paginatedResult, type PaginationParams } from "../lib/pagination"
import { notifyUser } from "./notification-dispatch.service"

const REACTION_LABELS: Record<CommunityReactionType, string> = {
  LIKE: "liked",
  LOVE: "loved",
  HAHA: "reacted 😂 to",
  WOW: "reacted 😮 to",
  SAD: "reacted 😢 to",
  ANGRY: "reacted 😠 to",
}

type PostWithUser = {
  id: string
  userId: string
  parentId: string | null
  threadRootId: string | null
  title: string | null
  content: string
  likes: number
  isPinned: boolean
  isHidden: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    email: string
    role: string
    student: { firstName: string; lastName: string } | null
  }
  _count?: { replies?: number; reports?: number }
}

export type ReactionSummary = {
  LIKE: number
  LOVE: number
  HAHA: number
  WOW: number
  SAD: number
  ANGRY: number
  total: number
}

export type MappedCommunityPost = ReturnType<typeof mapPost>
export type MappedCommunityComment = MappedCommunityPost & { children: MappedCommunityComment[] }

const REACTION_TYPES: CommunityReactionType[] = [
  "LIKE",
  "LOVE",
  "HAHA",
  "WOW",
  "SAD",
  "ANGRY",
]

const OFFICIAL_AUTHOR_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "INSTRUCTOR"])

function emptyReactionSummary(): ReactionSummary {
  return { LIKE: 0, LOVE: 0, HAHA: 0, WOW: 0, SAD: 0, ANGRY: 0, total: 0 }
}

function isOfficialAuthor(role: string) {
  return OFFICIAL_AUTHOR_ROLES.has(role)
}

function authorName(user: PostWithUser["user"]) {
  return user.student
    ? `${user.student.firstName} ${user.student.lastName}`
    : user.email.split("@")[0]
}

function postPreview(post: { title: string | null; content: string }) {
  return post.title || post.content.slice(0, 80)
}

async function notifyPostAuthorReaction(
  post: { id: string; userId: string; title: string | null; content: string; threadRootId: string | null },
  actorUserId: string,
  reactionType: CommunityReactionType
) {
  if (post.userId === actorUserId) return

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    include: { student: true },
  })
  if (!actor) return

  const name = actor.student
    ? `${actor.student.firstName} ${actor.student.lastName}`
    : actor.email.split("@")[0]
  const rootId = post.threadRootId ?? post.id

  await notifyUser({
    userId: post.userId,
    type: "COMMUNITY_REACTION",
    title: `${name} ${REACTION_LABELS[reactionType]} your post`,
    message: postPreview(post),
    link: `/dashboard/community?post=${rootId}`,
  })
}

async function notifyPostAuthorReply(
  rootPost: { id: string; userId: string; title: string | null; content: string },
  actorUserId: string
) {
  if (rootPost.userId === actorUserId) return

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    include: { student: true },
  })
  if (!actor) return

  const name = actor.student
    ? `${actor.student.firstName} ${actor.student.lastName}`
    : actor.email.split("@")[0]

  await notifyUser({
    userId: rootPost.userId,
    type: "COMMUNITY_REPLY",
    title: `${name} replied to your post`,
    message: postPreview(rootPost),
    link: `/dashboard/community?post=${rootPost.id}`,
  })
}

function mapPost(
  p: PostWithUser,
  viewerId?: string,
  viewerReaction?: CommunityReactionType | null,
  reactions?: ReactionSummary
) {
  const summary = reactions ?? emptyReactionSummary()
  const myReaction = viewerReaction ?? null
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    likes: p.likes,
    authorName: authorName(p.user),
    authorId: p.userId,
    parentId: p.parentId,
    threadRootId: p.threadRootId,
    isPinned: p.isPinned,
    isOfficial: isOfficialAuthor(p.user.role),
    replyCount: p._count?.replies ?? 0,
    reactions: summary,
    myReaction,
    likedByMe: myReaction !== null,
    isOwner: viewerId === p.userId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

function buildReplyTree(
  flat: MappedCommunityPost[],
  rootParentId: string
): MappedCommunityComment[] {
  const byParent = new Map<string, MappedCommunityPost[]>()
  for (const item of flat) {
    const parentKey = item.parentId ?? ""
    if (!byParent.has(parentKey)) byParent.set(parentKey, [])
    byParent.get(parentKey)!.push(item)
  }

  function build(parentId: string): MappedCommunityComment[] {
    return (byParent.get(parentId) ?? []).map((item) => ({
      ...item,
      children: build(item.id),
    }))
  }

  return build(rootParentId)
}

async function loadReactionData(postIds: string[], viewerId?: string) {
  const summaries = new Map<string, ReactionSummary>()
  const viewerReactions = new Map<string, CommunityReactionType>()

  for (const id of postIds) summaries.set(id, emptyReactionSummary())

  if (postIds.length === 0) {
    return { summaries, viewerReactions }
  }

  const grouped = await prisma.communityPostLike.groupBy({
    by: ["postId", "type"],
    where: { postId: { in: postIds } },
    _count: { _all: true },
  })

  for (const row of grouped) {
    const summary = summaries.get(row.postId) ?? emptyReactionSummary()
    summary[row.type] = row._count._all
    summary.total += row._count._all
    summaries.set(row.postId, summary)
  }

  if (viewerId) {
    const mine = await prisma.communityPostLike.findMany({
      where: { userId: viewerId, postId: { in: postIds } },
      select: { postId: true, type: true },
    })
    for (const row of mine) viewerReactions.set(row.postId, row.type)
  }

  return { summaries, viewerReactions }
}

async function countThreadReplies(rootPostId: string) {
  return prisma.communityPost.count({
    where: { threadRootId: rootPostId, isDeleted: false, isHidden: false },
  })
}

async function loadPreviewComments(postIds: string[]) {
  const previews = new Map<
    string,
    { id: string; authorName: string; content: string; createdAt: string }[]
  >()
  for (const id of postIds) previews.set(id, [])

  if (postIds.length === 0) return previews

  const comments = await prisma.communityPost.findMany({
    where: {
      parentId: { in: postIds },
      isDeleted: false,
      isHidden: false,
    },
    include: { user: { include: { student: true } } },
    orderBy: { createdAt: "desc" },
  })

  const grouped = new Map<string, typeof comments>()
  for (const comment of comments) {
    const rootId = comment.parentId!
    if (!grouped.has(rootId)) grouped.set(rootId, [])
    grouped.get(rootId)!.push(comment)
  }

  for (const [rootId, items] of grouped) {
    previews.set(
      rootId,
      items.slice(0, 2).map((c) => ({
        id: c.id,
        authorName: authorName(c.user),
        content: c.content,
        createdAt: c.createdAt.toISOString(),
      }))
    )
  }

  return previews
}

const publicPostWhere = {
  isDeleted: false,
  isHidden: false,
  parentId: null as string | null,
}

export async function listCommunityPosts(
  page = 1,
  limit = 20,
  viewerId?: string
) {
  const skip = (page - 1) * limit

  const [posts, total] = await Promise.all([
    prisma.communityPost.findMany({
      where: publicPostWhere,
      include: {
        user: { include: { student: true } },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    prisma.communityPost.count({ where: publicPostWhere }),
  ])

  const postIds = posts.map((p) => p.id)
  const [replyCounts, { summaries, viewerReactions }, previewMap] = await Promise.all([
    postIds.length
      ? prisma.communityPost.groupBy({
          by: ["threadRootId"],
          where: {
            threadRootId: { in: postIds },
            isDeleted: false,
            isHidden: false,
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    loadReactionData(postIds, viewerId),
    loadPreviewComments(postIds),
  ])

  const replyCountMap = new Map<string, number>()
  for (const row of replyCounts) {
    if (row.threadRootId) replyCountMap.set(row.threadRootId, row._count._all)
  }

  return {
    posts: posts.map((p) => ({
      ...mapPost(
        { ...p, _count: { replies: replyCountMap.get(p.id) ?? 0 } },
        viewerId,
        viewerReactions.get(p.id) ?? null,
        summaries.get(p.id)
      ),
      previewComments: previewMap.get(p.id) ?? [],
    })),
    total,
    page,
    limit,
  }
}

export async function getCommunityPost(postId: string, viewerId?: string) {
  const post = await prisma.communityPost.findFirst({
    where: {
      id: postId,
      isDeleted: false,
      isHidden: false,
      parentId: null,
    },
    include: {
      user: { include: { student: true } },
    },
  })

  if (!post) {
    throw Object.assign(new Error("Post not found"), { code: "NOT_FOUND" })
  }

  const [replies, replyCount] = await Promise.all([
    prisma.communityPost.findMany({
      where: {
        threadRootId: postId,
        isDeleted: false,
        isHidden: false,
      },
      include: { user: { include: { student: true } } },
      orderBy: { createdAt: "asc" },
    }),
    countThreadReplies(postId),
  ])

  const allIds = [postId, ...replies.map((r) => r.id)]
  const { summaries, viewerReactions } = await loadReactionData(allIds, viewerId)
  const flatReplies = replies.map((r) =>
    mapPost(r, viewerId, viewerReactions.get(r.id) ?? null, summaries.get(r.id))
  )

  return {
    post: mapPost(
      { ...post, _count: { replies: replyCount } },
      viewerId,
      viewerReactions.get(post.id) ?? null,
      summaries.get(post.id)
    ),
    replies: buildReplyTree(flatReplies, postId),
    replyCount,
  }
}

async function assertParentInThread(parentId: string, rootPostId: string) {
  if (parentId === rootPostId) return

  const parent = await prisma.communityPost.findFirst({
    where: { id: parentId, isDeleted: false, isHidden: false },
  })
  if (!parent || parent.threadRootId !== rootPostId) {
    throw Object.assign(new Error("Comment not found"), { code: "NOT_FOUND" })
  }
}

export async function createCommunityPost(
  userId: string,
  title: string,
  content: string
) {
  const post = await prisma.communityPost.create({
    data: {
      userId,
      title: sanitizePlainText(title, 200),
      content: sanitizePlainText(content),
    },
    include: {
      user: { include: { student: true } },
    },
  })

  return mapPost({ ...post, _count: { replies: 0 } }, userId, null, emptyReactionSummary())
}

export async function createCommunityReply(
  userId: string,
  rootPostId: string,
  content: string,
  parentId?: string
) {
  const root = await prisma.communityPost.findFirst({
    where: { id: rootPostId, isDeleted: false, isHidden: false, parentId: null },
  })
  if (!root) {
    throw Object.assign(new Error("Post not found"), { code: "NOT_FOUND" })
  }

  const replyParentId = parentId ?? rootPostId
  await assertParentInThread(replyParentId, rootPostId)

  const reply = await prisma.communityPost.create({
    data: {
      userId,
      parentId: replyParentId,
      threadRootId: rootPostId,
      content: sanitizePlainText(content, 2000),
    },
    include: { user: { include: { student: true } } },
  })

  await notifyPostAuthorReply(root, userId)

  return mapPost({ ...reply, _count: { replies: 0 } }, userId, null, emptyReactionSummary())
}

export async function updateCommunityPost(
  userId: string,
  postId: string,
  data: { title?: string; content?: string }
) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId } })
  if (!post || post.isDeleted) {
    throw Object.assign(new Error("Post not found"), { code: "NOT_FOUND" })
  }
  if (post.userId !== userId) {
    throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" })
  }

  const updated = await prisma.communityPost.update({
    where: { id: postId },
    data: {
      title: data.title !== undefined ? sanitizePlainText(data.title, 200) : undefined,
      content: data.content !== undefined ? sanitizePlainText(data.content) : undefined,
    },
    include: {
      user: { include: { student: true } },
    },
  })

  return mapPost(updated, userId, null, emptyReactionSummary())
}

export async function deleteCommunityPost(userId: string, postId: string) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId } })
  if (!post || post.isDeleted) {
    throw Object.assign(new Error("Post not found"), { code: "NOT_FOUND" })
  }
  if (post.userId !== userId) {
    throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" })
  }

  await prisma.communityPost.update({
    where: { id: postId },
    data: { isDeleted: true },
  })

  return { id: postId, deleted: true }
}

export async function toggleCommunityPostLike(userId: string, postId: string) {
  return setCommunityReaction(userId, postId, "LIKE")
}

export async function setCommunityReaction(
  userId: string,
  postId: string,
  type: CommunityReactionType
) {
  const post = await prisma.communityPost.findFirst({
    where: { id: postId, isDeleted: false, isHidden: false },
  })
  if (!post) {
    throw Object.assign(new Error("Post not found"), { code: "NOT_FOUND" })
  }

  const existing = await prisma.communityPostLike.findUnique({
    where: { postId_userId: { postId, userId } },
  })

  if (existing) {
    if (existing.type === type) {
      await prisma.$transaction([
        prisma.communityPostLike.delete({ where: { id: existing.id } }),
        prisma.communityPost.update({
          where: { id: postId },
          data: { likes: { decrement: 1 } },
        }),
      ])
      const reactions = await loadReactionSummary(postId)
      return {
        id: postId,
        likes: post.likes - 1,
        likedByMe: false,
        myReaction: null as CommunityReactionType | null,
        reactions,
      }
    }

    await prisma.communityPostLike.update({
      where: { id: existing.id },
      data: { type },
    })
    const reactions = await loadReactionSummary(postId)
    return {
      id: postId,
      likes: post.likes,
      likedByMe: true,
      myReaction: type,
      reactions,
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.communityPostLike.create({ data: { postId, userId, type } })
    return tx.communityPost.update({
      where: { id: postId },
      data: { likes: { increment: 1 } },
    })
  })

  await notifyPostAuthorReaction(post, userId, type)

  const reactions = await loadReactionSummary(postId)
  return {
    id: postId,
    likes: updated.likes,
    likedByMe: true,
    myReaction: type,
    reactions,
  }
}

async function loadReactionSummary(postId: string): Promise<ReactionSummary> {
  const grouped = await prisma.communityPostLike.groupBy({
    by: ["type"],
    where: { postId },
    _count: { _all: true },
  })
  const summary = emptyReactionSummary()
  for (const row of grouped) {
    summary[row.type] = row._count._all
    summary.total += row._count._all
  }
  return summary
}

export async function reportCommunityPost(
  userId: string,
  postId: string,
  reason?: string
) {
  const post = await prisma.communityPost.findFirst({
    where: { id: postId, isDeleted: false },
  })
  if (!post) {
    throw Object.assign(new Error("Post not found"), { code: "NOT_FOUND" })
  }

  await prisma.communityPostReport.upsert({
    where: { postId_userId: { postId, userId } },
    create: {
      postId,
      userId,
      reason: reason ? sanitizePlainText(reason, 500) : null,
    },
    update: {
      reason: reason ? sanitizePlainText(reason, 500) : null,
    },
  })

  return { reported: true }
}

export type AdminCommunityFilter = "all" | "reported" | "hidden" | "deleted"

function mapAdminPost(p: PostWithUser) {
  return {
    ...mapPost(p),
    isHidden: p.isHidden,
    isDeleted: p.isDeleted,
    reportCount: p._count?.reports ?? 0,
  }
}

function adminListWhere(
  filter: AdminCommunityFilter,
  search?: string
): Prisma.CommunityPostWhereInput {
  const base: Prisma.CommunityPostWhereInput = { parentId: null }
  let where: Prisma.CommunityPostWhereInput

  switch (filter) {
    case "reported":
      where = { ...base, reports: { some: {} } }
      break
    case "hidden":
      where = { ...base, isHidden: true, isDeleted: false }
      break
    case "deleted":
      where = { ...base, isDeleted: true }
      break
    default:
      where = base
  }

  if (search?.trim()) {
    const q = search.trim()
    where = {
      ...where,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { student: { firstName: { contains: q, mode: "insensitive" } } } },
        { user: { student: { lastName: { contains: q, mode: "insensitive" } } } },
      ],
    }
  }

  return where
}

export async function countReportedCommunityPosts() {
  return prisma.communityPost.count({
    where: { parentId: null, isDeleted: false, reports: { some: {} } },
  })
}

export async function listAdminCommunityPosts(
  pagination: PaginationParams,
  filter: AdminCommunityFilter = "all",
  search?: string
) {
  const { page, pageSize, skip } = pagination
  const where = adminListWhere(filter, search)
  const orderBy =
    filter === "reported"
      ? [{ reports: { _count: "desc" as const } }, { createdAt: "desc" as const }]
      : [{ isPinned: "desc" as const }, { createdAt: "desc" as const }]

  const [posts, total] = await Promise.all([
    prisma.communityPost.findMany({
      where,
      include: {
        user: { include: { student: true } },
        _count: { select: { replies: true, reports: true } },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma.communityPost.count({ where }),
  ])

  return paginatedResult(posts.map(mapAdminPost), total, page, pageSize)
}

export async function getAdminCommunityPost(postId: string) {
  const post = await prisma.communityPost.findFirst({
    where: { id: postId, parentId: null },
    include: {
      user: { include: { student: true } },
      _count: { select: { replies: true, reports: true } },
    },
  })

  if (!post) {
    throw Object.assign(new Error("Post not found"), { code: "NOT_FOUND" })
  }

  const replies = await prisma.communityPost.findMany({
    where: { threadRootId: postId },
    include: {
      user: { include: { student: true } },
      _count: { select: { reports: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  const flatReplies = replies.map((r) => mapAdminPost(r))
  return {
    post: mapAdminPost(post),
    replies: buildReplyTree(flatReplies, postId),
  }
}

export async function listAdminCommunityPostReports(postId: string) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId } })
  if (!post) {
    throw Object.assign(new Error("Post not found"), { code: "NOT_FOUND" })
  }

  const reports = await prisma.communityPostReport.findMany({
    where: { postId },
    include: { user: { include: { student: true } } },
    orderBy: { createdAt: "desc" },
  })

  return reports.map((r) => ({
    id: r.id,
    postId: r.postId,
    reporterName: authorName(r.user),
    reporterEmail: r.user.email,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function createAdminCommunityPost(
  adminUserId: string,
  data: { title: string; content: string; isPinned?: boolean; isHidden?: boolean }
) {
  const post = await prisma.communityPost.create({
    data: {
      userId: adminUserId,
      title: sanitizePlainText(data.title, 200),
      content: sanitizePlainText(data.content),
      isPinned: data.isPinned ?? true,
      isHidden: data.isHidden ?? false,
    },
    include: {
      user: { include: { student: true } },
      _count: { select: { replies: true, reports: true } },
    },
  })

  return mapAdminPost(post)
}

export async function moderateCommunityPost(
  postId: string,
  data: {
    title?: string
    content?: string
    isHidden?: boolean
    isPinned?: boolean
    isDeleted?: boolean
  }
) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId } })
  if (!post) {
    throw Object.assign(new Error("Post not found"), { code: "NOT_FOUND" })
  }

  const updated = await prisma.communityPost.update({
    where: { id: postId },
    data: {
      title: data.title !== undefined ? sanitizePlainText(data.title, 200) : undefined,
      content: data.content !== undefined ? sanitizePlainText(data.content) : undefined,
      isHidden: data.isHidden,
      isPinned: data.isPinned,
      isDeleted: data.isDeleted,
    },
    include: {
      user: { include: { student: true } },
      _count: { select: { replies: true, reports: true } },
    },
  })

  return mapAdminPost(updated)
}

export { REACTION_TYPES }
