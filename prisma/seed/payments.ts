import type { PrismaClient } from "@prisma/client"
import type { SeedUsers } from "./users"
import { MANUAL_PAYMENT_PROVIDERS } from "../../src/lib/manual-payment"
import { daysAgo, daysFromNow } from "./helpers"

const INSTITUTIONAL_PLAN_LABEL = "3 Monthly Payments"

export async function seedPayments(prisma: PrismaClient, users: SeedUsers) {
  await prisma.paymentSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      enabledGateways: ["sslcommerz"],
      defaultGateway: "sslcommerz",
      allowUserChoice: false,
    },
    update: {
      enabledGateways: ["sslcommerz"],
      allowUserChoice: false,
    },
  })

  for (const id of MANUAL_PAYMENT_PROVIDERS) {
    const isBkash = id === "bkash"
    await prisma.manualPaymentMethod.upsert({
      where: { id },
      create: {
        id,
        enabled: isBkash,
        merchantNumber: isBkash ? "01700000001" : "",
        merchantName: isBkash ? "FX Prime Academy" : null,
      },
      update: isBkash
        ? {
            enabled: true,
            merchantNumber: "01700000001",
            merchantName: "FX Prime Academy",
          }
        : {},
    })
  }

  const institutional = await prisma.course.findUnique({
    where: { slug: "institutional-forex-mastery" },
  })
  if (!institutional) return

  let plan = await prisma.installmentPlan.findFirst({
    where: { courseId: institutional.id, label: INSTITUTIONAL_PLAN_LABEL },
  })
  if (!plan) {
    plan = await prisma.installmentPlan.create({
      data: {
        courseId: institutional.id,
        label: INSTITUTIONAL_PLAN_LABEL,
        totalAmount: 300,
        installmentCount: 3,
        intervalDays: 30,
        downPaymentPercent: 33,
        isActive: true,
      },
    })
  }

  const rashedId = users.rashed.student!.id
  const existingAgreement = await prisma.installmentAgreement.findFirst({
    where: { studentId: rashedId, courseId: institutional.id },
  })

  if (!existingAgreement) {
    const downPayment = 99
    const regular = 100.5
    await prisma.installmentAgreement.create({
      data: {
        studentId: rashedId,
        planId: plan.id,
        courseId: institutional.id,
        totalAmount: 300,
        paidAmount: downPayment,
        status: "ACTIVE",
        nextDueDate: daysFromNow(25),
        installments: {
          create: [
            {
              installmentNo: 1,
              amount: downPayment,
              dueDate: daysAgo(30),
              status: "PAID",
              paidAt: daysAgo(30),
            },
            {
              installmentNo: 2,
              amount: regular,
              dueDate: daysFromNow(25),
              status: "PENDING",
            },
            {
              installmentNo: 3,
              amount: regular,
              dueDate: daysFromNow(55),
              status: "PENDING",
            },
          ],
        },
      },
    })
  }

  const existingManualPayment = await prisma.paymentRecord.findFirst({
    where: { referenceCode: "FXP-SEED" },
  })
  if (!existingManualPayment) {
    await prisma.paymentRecord.create({
      data: {
        studentId: rashedId,
        type: "COURSE",
        courseId: institutional.id,
        amount: 300,
        currency: "BDT",
        gateway: "bkash",
        status: "AWAITING_VERIFICATION",
        referenceCode: "FXP-SEED",
        senderNumber: "01898765432",
        proofUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400",
        submittedAt: daysAgo(1),
        expiresAt: daysFromNow(2),
        metadata: { courseSlug: "institutional-forex-mastery" },
      },
    })
  }

  const existingInquiry = await prisma.contactInquiry.findFirst({
    where: { email: "prospect@example.com", subject: "COURSE" },
  })
  if (!existingInquiry) {
    await prisma.contactInquiry.create({
      data: {
        name: "Karim Uddin",
        email: "prospect@example.com",
        phone: "01911223344",
        subject: "COURSE",
        message: "I am interested in the Institutional Forex Mastery course. Do you offer installment plans?",
        status: "OPEN",
      },
    })
  }
}
