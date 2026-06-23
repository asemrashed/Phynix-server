import type { PrismaClient } from "@prisma/client"
import type { SeedUsers } from "./users"
import { daysAgo, daysFromNow, getCourseLessonCount, seedEnrollmentWithLessons } from "./helpers"

export async function seedStudentData(
  prisma: PrismaClient,
  users: SeedUsers
) {
  const adnanId = users.adnan.student!.id
  const rashedId = users.rashed.student!.id
  const demoId = users.demoStudent.student!.id

  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)

  await prisma.subscription.upsert({
    where: { studentId: adnanId },
    update: { plan: "PRO", status: "ACTIVE", expiresAt },
    create: {
      studentId: adnanId,
      plan: "PRO",
      status: "ACTIVE",
      expiresAt,
      gateway: "sslcommerz",
    },
  })

  for (const studentId of [rashedId, demoId]) {
    await prisma.subscription.upsert({
      where: { studentId },
      update: { plan: "FREE", status: "ACTIVE", expiresAt: null },
      create: { studentId, plan: "FREE", status: "ACTIVE" },
    })
  }

  await seedEnrollmentWithLessons(prisma, adnanId, "forex-course-bangla", {
    completedLessons: await getCourseLessonCount(prisma, "forex-course-bangla"),
    completedAt: daysAgo(14),
    certificateStatus: "ISSUED",
  })

  await seedEnrollmentWithLessons(prisma, adnanId, "forex-trading-masterclass", {
    completedLessons: 3,
    partialWatchPosition: 900,
  })

  await seedEnrollmentWithLessons(prisma, rashedId, "institutional-forex-mastery", {
    completedLessons: 1,
    partialWatchPosition: 600,
  })

  await seedEnrollmentWithLessons(prisma, demoId, "forex-course-bangla", {
    completedLessons: await getCourseLessonCount(prisma, "forex-course-bangla"),
    completedAt: daysAgo(7),
    certificateStatus: "ISSUED",
  })

  const banglaCourse = await prisma.course.findUnique({ where: { slug: "forex-course-bangla" } })
  if (banglaCourse) {
    for (const { studentId, userId } of [
      { studentId: adnanId, userId: users.adnan.id },
      { studentId: demoId, userId: users.demoStudent.id },
    ]) {
      const existingCert = await prisma.certificate.findFirst({
        where: { studentId, courseId: banglaCourse.id },
      })
      if (!existingCert) {
        const { generateCertificate } = await import("../../src/services/certificate.service")
        await generateCertificate(studentId, banglaCourse.id, userId)
      }
    }

    await prisma.courseReview.upsert({
      where: { studentId_courseId: { studentId: adnanId, courseId: banglaCourse.id } },
      update: { rating: 5, review: "Excellent course — very clear explanations!" },
      create: {
        studentId: adnanId,
        courseId: banglaCourse.id,
        rating: 5,
        review: "Excellent course — very clear explanations!",
      },
    })
  }

  const journal = await prisma.digitalProduct.findUnique({
    where: { slug: "forex-trading-journal" },
  })
  if (journal) {
    await prisma.productPurchase.upsert({
      where: { studentId_productId: { studentId: adnanId, productId: journal.id } },
      update: { downloadCount: 2 },
      create: {
        studentId: adnanId,
        productId: journal.id,
        downloadCount: 2,
        paymentRef: "SEED-FREE-JOURNAL",
      },
    })
  }

  const notebook = await prisma.physicalProduct.findUnique({
    where: { slug: "branded-notebook" },
  })
  if (notebook) {
    const shippingAddress = {
      name: "Adnan Hossain",
      phone: "01712345678",
      address: "House 12, Road 5, Dhanmondi",
      city: "Dhaka",
      postalCode: "1209",
    }

    const existingAddress = await prisma.savedAddress.findFirst({
      where: { studentId: adnanId, label: "Home" },
    })
    if (!existingAddress) {
      await prisma.savedAddress.create({
        data: {
          studentId: adnanId,
          label: "Home",
          name: "Adnan Hossain",
          phone: "01712345678",
          address: "House 12, Road 5, Dhanmondi",
          city: "Dhaka",
          postalCode: "1209",
          isDefault: true,
        },
      })
    }

    const existingOrder = await prisma.order.findUnique({ where: { orderCode: "FXP-000001" } })
    if (!existingOrder) {
      await prisma.order.create({
        data: {
          orderCode: "FXP-000001",
          studentId: adnanId,
          status: "DELIVERED",
          subtotal: notebook.price,
          shippingFee: 60,
          total: Number(notebook.price) + 60,
          currency: "BDT",
          shippingAddress,
          paymentRef: "SEED-ORDER-001",
          gateway: "sslcommerz",
          items: {
            create: {
              productId: notebook.id,
              quantity: 1,
              unitPrice: notebook.price,
            },
          },
        },
      })
    }

    const existingPayment = await prisma.paymentRecord.findFirst({
      where: { tranId: "SEED-TXN-001" },
    })
    if (!existingPayment) {
      await prisma.paymentRecord.create({
        data: {
          studentId: adnanId,
          type: "PHYSICAL_ORDER",
          entityId: notebook.id,
          amount: Number(notebook.price) + 60,
          currency: "BDT",
          gateway: "sslcommerz",
          status: "COMPLETED",
          paymentRef: "SEED-PAY-001",
          tranId: "SEED-TXN-001",
          metadata: { orderCode: "FXP-000001" },
        },
      })
    }
  }

  const existingSubPayment = await prisma.paymentRecord.findFirst({
    where: { tranId: "SEED-TXN-PRO" },
  })
  if (!existingSubPayment) {
    await prisma.paymentRecord.create({
      data: {
        studentId: adnanId,
        type: "SUBSCRIPTION",
        amount: 29.99,
        currency: "BDT",
        gateway: "sslcommerz",
        status: "COMPLETED",
        paymentRef: "SEED-SUB-PRO",
        tranId: "SEED-TXN-PRO",
        metadata: { plan: "PRO" },
      },
    })
  }

  const liveSession = await prisma.liveSession.findFirst({
    where: { title: "Weekly Market Review — Live Q&A" },
  })
  if (liveSession) {
    await prisma.sessionRegistration.upsert({
      where: {
        sessionId_studentId: { sessionId: liveSession.id, studentId: adnanId },
      },
      update: {},
      create: { sessionId: liveSession.id, studentId: adnanId },
    })
  }

  const masterclass = await prisma.course.findUnique({
    where: { slug: "forex-trading-masterclass" },
    include: { sections: { include: { lessons: true } } },
  })

  for (let i = 0; i < 7; i++) {
    const lessonId = masterclass?.sections.flatMap((s) => s.lessons)[i % 3]?.id
    const createdAt = daysAgo(6 - i)
    const exists = await prisma.learningActivity.findFirst({
      where: {
        studentId: adnanId,
        type: i % 2 === 0 ? "LESSON_COMPLETED" : "LESSON_PAUSED",
        createdAt,
      },
    })
    if (exists) continue
    await prisma.learningActivity.create({
      data: {
        studentId: adnanId,
        type: i % 2 === 0 ? "LESSON_COMPLETED" : "LESSON_PAUSED",
        entityId: lessonId,
        entityType: "LESSON",
        metadata: { watchPosition: 1800 },
        createdAt,
      },
    })
  }

  for (let i = 0; i < 3; i++) {
    const createdAt = daysAgo(2 - i)
    const exists = await prisma.learningActivity.findFirst({
      where: { studentId: rashedId, type: "LESSON_COMPLETED", createdAt },
    })
    if (exists) continue
    await prisma.learningActivity.create({
      data: {
        studentId: rashedId,
        type: "LESSON_COMPLETED",
        entityType: "LESSON",
        metadata: { watchPosition: 1200 },
        createdAt,
      },
    })
  }

  const notifications = [
    {
      userId: users.adnan.id,
      type: "WELCOME",
      title: "Welcome to FX Prime Academy",
      message: "Start exploring courses and build your trading skills today.",
      isRead: false,
    },
    {
      userId: users.adnan.id,
      type: "COURSE_COMPLETED",
      title: "Course completed",
      message: "Congratulations! You completed the Forex Starter course.",
      link: "/dashboard/certificates",
      isRead: true,
    },
    {
      userId: users.adnan.id,
      type: "ORDER_DELIVERED",
      title: "Order delivered",
      message: "Your order FXP-000001 has been delivered.",
      link: "/dashboard/orders",
      isRead: true,
    },
    {
      userId: users.supportUser.id,
      type: "SYSTEM",
      title: "Support queue ready",
      message: "2 new tickets awaiting review.",
      isRead: false,
    },
    {
      userId: users.supportUser.id,
      type: "SYSTEM",
      title: "Platform update",
      message: "New community moderation tools are available.",
      isRead: false,
    },
  ]

  for (const n of notifications) {
    const exists = await prisma.notification.findFirst({
      where: { userId: n.userId, title: n.title },
    })
    if (!exists) {
      await prisma.notification.create({ data: n })
    } else if (n.type === "COURSE_COMPLETED") {
      await prisma.notification.update({
        where: { id: exists.id },
        data: { message: n.message },
      })
    }
  }
}
