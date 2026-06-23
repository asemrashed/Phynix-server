import type { PrismaClient } from "@prisma/client"
import type { SeedUsers } from "./users"

export async function seedEngagement(prisma: PrismaClient, users: SeedUsers) {
  const [
    masterclass,
    institutional,
    blogOutlook,
    blogPremium,
    journal,
    mousePad,
  ] = await Promise.all([
    prisma.course.findUnique({ where: { slug: "forex-trading-masterclass" } }),
    prisma.course.findUnique({ where: { slug: "institutional-forex-mastery" } }),
    prisma.blogPost.findUnique({ where: { slug: "eur-usd-weekly-outlook" } }),
    prisma.blogPost.findUnique({ where: { slug: "ict-fair-value-gaps" } }),
    prisma.digitalProduct.findUnique({ where: { slug: "smc-ict-cheat-sheet" } }),
    prisma.physicalProduct.findUnique({ where: { slug: "trading-mouse-pad" } }),
  ])

  const bookmarks = [
    masterclass && {
      userId: users.adnan.id,
      entityType: "COURSE",
      entityId: masterclass.id,
    },
    blogOutlook && {
      userId: users.adnan.id,
      entityType: "BLOG",
      entityId: blogOutlook.id,
    },
    journal && {
      userId: users.adnan.id,
      entityType: "DIGITAL_PRODUCT",
      entityId: journal.id,
    },
    blogPremium && {
      userId: users.rashed.id,
      entityType: "BLOG",
      entityId: blogPremium.id,
    },
  ].filter(Boolean) as { userId: string; entityType: string; entityId: string }[]

  for (const b of bookmarks) {
    await prisma.bookmark.upsert({
      where: {
        userId_entityType_entityId: {
          userId: b.userId,
          entityType: b.entityType,
          entityId: b.entityId,
        },
      },
      update: {},
      create: b,
    })
  }

  const wishlist = [
    institutional && {
      userId: users.adnan.id,
      entityType: "COURSE",
      entityId: institutional.id,
    },
    mousePad && {
      userId: users.adnan.id,
      entityType: "PHYSICAL_PRODUCT",
      entityId: mousePad.id,
    },
  ].filter(Boolean) as { userId: string; entityType: string; entityId: string }[]

  for (const w of wishlist) {
    await prisma.wishlistItem.upsert({
      where: {
        userId_entityType_entityId: {
          userId: w.userId,
          entityType: w.entityType,
          entityId: w.entityId,
        },
      },
      update: {},
      create: w,
    })
  }

  let welcomePost = await prisma.communityPost.findFirst({
    where: { title: "Welcome to FX Prime Community!" },
  })
  if (!welcomePost) {
    welcomePost = await prisma.communityPost.create({
      data: {
        userId: users.adminUser.id,
        title: "Welcome to FX Prime Community!",
        content:
          "Share your trading journey, ask questions, and connect with fellow traders. Let's grow together!",
        likes: 12,
      },
    })
  }

  let eurPost = await prisma.communityPost.findFirst({
    where: { title: "EUR/USD Setup Discussion" },
  })
  if (!eurPost) {
    eurPost = await prisma.communityPost.create({
      data: {
        userId: users.rashed.id,
        title: "EUR/USD Setup Discussion",
        content:
          "Anyone watching the 1.0850 support level this week? I see a potential bullish OB forming on H4.",
        likes: 5,
      },
    })
  }

  let adnanPost = await prisma.communityPost.findFirst({
    where: { title: "My first profitable week!" },
  })
  if (!adnanPost) {
    adnanPost = await prisma.communityPost.create({
      data: {
        userId: users.adnan.id,
        title: "My first profitable week!",
        content:
          "Finally closed my first green week using the Forex Starter course strategies. Risk management made all the difference!",
        likes: 8,
      },
    })
  } else {
    await prisma.communityPost.update({
      where: { id: adnanPost.id },
      data: {
        content:
          "Finally closed my first green week using the Forex Starter course strategies. Risk management made all the difference!",
      },
    })
  }

  const replyExists = await prisma.communityPost.findFirst({
    where: { parentId: eurPost.id, userId: users.adnan.id },
  })
  if (!replyExists) {
    await prisma.communityPost.create({
      data: {
        userId: users.adnan.id,
        parentId: eurPost.id,
        threadRootId: eurPost.id,
        content: "Yes! I'm watching 1.0850 too — waiting for London session confirmation.",
      },
    })
  } else if (!replyExists.threadRootId) {
    await prisma.communityPost.update({
      where: { id: replyExists.id },
      data: { threadRootId: eurPost.id },
    })
  }

  for (const { postId, userId } of [
    { postId: welcomePost.id, userId: users.rashed.id },
    { postId: adnanPost.id, userId: users.rashed.id },
    { postId: eurPost.id, userId: users.adnan.id },
  ]) {
    await prisma.communityPostLike.upsert({
      where: { postId_userId: { postId, userId } },
      update: {},
      create: { postId, userId },
    }).catch(() => {})
  }
}
