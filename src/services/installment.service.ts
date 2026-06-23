import type {
  AdminInstallmentPlanInput,
  InstallmentAgreementItem,
  InstallmentPlanItem,
  PaymentGateway,
} from "@fxprime/types"
import { prisma } from "../lib/prisma"
import {
  createManualPaymentCheckout,
  enrichManualPaymentRecord,
} from "./manual-payment.service"
import { createPaymentRecord, paymentBaseUrl } from "./payment-core.service"
import { isManualPaymentGateway } from "../lib/manual-payment"
import { resolveCheckoutGateway } from "./payment-gateway.service"
import { getGatewayCurrency } from "./payment-gateway.service"

function calculateInstallmentAmounts(
  totalAmount: number,
  installmentCount: number,
  downPaymentPercent: number
): number[] {
  if (installmentCount < 2) {
    return [Math.round(totalAmount * 100) / 100]
  }

  const down = Math.round(((totalAmount * downPaymentPercent) / 100) * 100) / 100
  const remaining = Math.round((totalAmount - down) * 100) / 100
  const regularCount = installmentCount - 1
  const regular = Math.round((remaining / regularCount) * 100) / 100
  const amounts = [down, ...Array.from({ length: regularCount }, () => regular)]
  const diff = Math.round((totalAmount - amounts.reduce((sum, value) => sum + value, 0)) * 100) / 100
  amounts[amounts.length - 1] = Math.round((amounts[amounts.length - 1]! + diff) * 100) / 100
  return amounts
}

export async function listCourseInstallmentPlans(courseId: string): Promise<InstallmentPlanItem[]> {
  const plans = await prisma.installmentPlan.findMany({
    where: { courseId, isActive: true },
    include: { course: { select: { title: true } } },
    orderBy: { createdAt: "asc" },
  })

  return plans.map((plan) => ({
    id: plan.id,
    courseId: plan.courseId,
    courseTitle: plan.course.title,
    label: plan.label,
    totalAmount: Number(plan.totalAmount),
    installmentCount: plan.installmentCount,
    intervalDays: plan.intervalDays,
    downPaymentPercent: plan.downPaymentPercent,
    isActive: plan.isActive,
  }))
}

export async function upsertInstallmentPlan(input: AdminInstallmentPlanInput) {
  const course = await prisma.course.findUnique({ where: { id: input.courseId } })
  if (!course) throw Object.assign(new Error("Course not found"), { code: "NOT_FOUND" })

  const plan = await prisma.installmentPlan.create({
    data: {
      courseId: input.courseId,
      label: input.label,
      totalAmount: input.totalAmount,
      installmentCount: input.installmentCount,
      intervalDays: input.intervalDays ?? 30,
      downPaymentPercent: input.downPaymentPercent ?? 33,
      isActive: input.isActive ?? true,
    },
    include: { course: { select: { title: true } } },
  })

  return {
    id: plan.id,
    courseId: plan.courseId,
    courseTitle: plan.course.title,
    label: plan.label,
    totalAmount: Number(plan.totalAmount),
    installmentCount: plan.installmentCount,
    intervalDays: plan.intervalDays,
    downPaymentPercent: plan.downPaymentPercent,
    isActive: plan.isActive,
  } satisfies InstallmentPlanItem
}

export async function createInstallmentAgreement(
  studentId: string,
  userId: string,
  courseId: string,
  planId: string,
  gateway?: PaymentGateway
) {
  const existingEnrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  })
  if (existingEnrollment) {
    throw Object.assign(new Error("Already enrolled"), { code: "ALREADY_ENROLLED" })
  }

  const activeAgreement = await prisma.installmentAgreement.findFirst({
    where: { studentId, courseId, status: "ACTIVE" },
  })
  if (activeAgreement) {
    throw Object.assign(new Error("Active installment agreement exists"), {
      code: "ACTIVE_AGREEMENT",
    })
  }

  const plan = await prisma.installmentPlan.findFirst({
    where: { id: planId, courseId, isActive: true },
    include: { course: true },
  })
  if (!plan) throw Object.assign(new Error("Installment plan not found"), { code: "NOT_FOUND" })

  const resolvedGateway = await resolveCheckoutGateway(gateway)
  const amounts = calculateInstallmentAmounts(
    Number(plan.totalAmount),
    plan.installmentCount,
    plan.downPaymentPercent
  )

  const now = new Date()
  const agreement = await prisma.installmentAgreement.create({
    data: {
      studentId,
      planId: plan.id,
      courseId,
      totalAmount: plan.totalAmount,
      paidAmount: 0,
      status: "ACTIVE",
      nextDueDate: now,
      installments: {
        create: amounts.map((amount, index) => ({
          installmentNo: index + 1,
          amount,
          dueDate: new Date(now.getTime() + index * plan.intervalDays * 24 * 60 * 60 * 1000),
          status: index === 0 ? "PENDING" : "PENDING",
        })),
      },
    },
    include: { installments: { orderBy: { installmentNo: "asc" } } },
  })

  const firstInstallment = agreement.installments[0]!
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  })
  if (!student) throw Object.assign(new Error("Student not found"), { code: "NOT_FOUND" })

  const payment = await createPaymentRecord({
    studentId,
    userId,
    type: "COURSE",
    amount: Number(firstInstallment.amount),
    currency: getGatewayCurrency(resolvedGateway),
    gateway: resolvedGateway,
    productName: `${plan.course.title} — Installment 1/${plan.installmentCount}`,
    courseId,
    metadata: {
      installmentAgreementId: agreement.id,
      installmentPaymentId: firstInstallment.id,
      installmentNo: 1,
    },
    customer: {
      name: `${student.firstName} ${student.lastName}`,
      email: student.user.email,
      phone: student.phone || undefined,
    },
  })

  await prisma.installmentPayment.update({
    where: { id: firstInstallment.id },
    data: { paymentRecordId: payment.id },
  })

  if (isManualPaymentGateway(resolvedGateway)) {
    await enrichManualPaymentRecord(payment.id)
    const manual = await createManualPaymentCheckout(payment.id)
    return {
      agreementId: agreement.id,
      installmentNo: 1,
      ...manual,
      gateway: resolvedGateway,
    }
  }

  const checkoutUrl = `${paymentBaseUrl()}/checkout?paymentId=${payment.id}&gateway=${resolvedGateway}&dev=1`
  return {
    agreementId: agreement.id,
    paymentId: payment.id,
    installmentNo: 1,
    checkoutUrl,
    gateway: resolvedGateway,
    manual: false as const,
  }
}

export async function listStudentInstallmentAgreements(
  studentId: string
): Promise<InstallmentAgreementItem[]> {
  const agreements = await prisma.installmentAgreement.findMany({
    where: { studentId },
    include: {
      plan: true,
      installments: { orderBy: { installmentNo: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  })

  const courseIds = [...new Set(agreements.map((a) => a.courseId))]
  const courses = courseIds.length
    ? await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } })
    : []
  const courseMap = new Map(courses.map((c) => [c.id, c.title]))

  return agreements.map((agreement) => ({
    id: agreement.id,
    courseId: agreement.courseId,
    courseTitle: courseMap.get(agreement.courseId) || "Course",
    planLabel: agreement.plan.label,
    totalAmount: Number(agreement.totalAmount),
    paidAmount: Number(agreement.paidAmount),
    status: agreement.status,
    nextDueDate: agreement.nextDueDate?.toISOString() ?? null,
    accessSuspendedAt: agreement.accessSuspendedAt?.toISOString() ?? null,
    installments: agreement.installments.map((item) => ({
      id: item.id,
      installmentNo: item.installmentNo,
      amount: Number(item.amount),
      dueDate: item.dueDate.toISOString(),
      status: item.status,
      paidAt: item.paidAt?.toISOString() ?? null,
      paymentId: item.paymentRecordId,
    })),
  }))
}

export async function createInstallmentPaymentSession(
  studentId: string,
  userId: string,
  installmentPaymentId: string,
  gateway?: PaymentGateway
) {
  const installment = await prisma.installmentPayment.findUnique({
    where: { id: installmentPaymentId },
    include: {
      agreement: { include: { plan: true, student: { include: { user: true } } } },
    },
  })
  if (!installment || installment.agreement.studentId !== studentId) {
    throw Object.assign(new Error("Installment not found"), { code: "NOT_FOUND" })
  }
  if (installment.status === "PAID") {
    throw Object.assign(new Error("Installment already paid"), { code: "ALREADY_PAID" })
  }
  if (installment.paymentRecordId) {
    const existing = await prisma.paymentRecord.findUnique({
      where: { id: installment.paymentRecordId },
    })
    if (existing && ["PENDING", "AWAITING_VERIFICATION", "REJECTED"].includes(existing.status)) {
      if (isManualPaymentGateway(existing.gateway)) {
        return {
          ...(await createManualPaymentCheckout(existing.id)),
          gateway: existing.gateway,
        }
      }
    }
  }

  const resolvedGateway = await resolveCheckoutGateway(gateway)
  const course = await prisma.course.findUnique({ where: { id: installment.agreement.courseId } })

  const payment = await createPaymentRecord({
    studentId,
    userId,
    type: "COURSE",
    amount: Number(installment.amount),
    currency: getGatewayCurrency(resolvedGateway),
    gateway: resolvedGateway,
    productName: `${course?.title || "Course"} — Installment ${installment.installmentNo}/${installment.agreement.plan.installmentCount}`,
    courseId: installment.agreement.courseId,
    metadata: {
      installmentAgreementId: installment.agreementId,
      installmentPaymentId: installment.id,
      installmentNo: installment.installmentNo,
    },
    customer: {
      name: `${installment.agreement.student.firstName} ${installment.agreement.student.lastName}`,
      email: installment.agreement.student.user.email,
      phone: installment.agreement.student.phone || undefined,
    },
  })

  await prisma.installmentPayment.update({
    where: { id: installment.id },
    data: { paymentRecordId: payment.id, status: "PENDING" },
  })

  if (isManualPaymentGateway(resolvedGateway)) {
    await enrichManualPaymentRecord(payment.id)
    return {
      ...(await createManualPaymentCheckout(payment.id)),
      gateway: resolvedGateway,
    }
  }

  return {
    paymentId: payment.id,
    checkoutUrl: `${paymentBaseUrl()}/checkout?paymentId=${payment.id}&gateway=${resolvedGateway}&dev=1`,
    gateway: resolvedGateway,
    manual: false as const,
  }
}

export async function markInstallmentPaid(installmentPaymentId: string) {
  const installment = await prisma.installmentPayment.findUnique({
    where: { id: installmentPaymentId },
    include: { agreement: { include: { installments: true } } },
  })
  if (!installment) return

  const paidAt = new Date()
  await prisma.installmentPayment.update({
    where: { id: installmentPaymentId },
    data: { status: "PAID", paidAt },
  })

  const paidAmount =
    Number(installment.agreement.paidAmount) + Number(installment.amount)
  const unpaid = installment.agreement.installments.filter(
    (item) => item.id !== installmentPaymentId && item.status !== "PAID"
  )
  const nextDue = unpaid.sort((a, b) => a.installmentNo - b.installmentNo)[0]
  const hasOverdue = unpaid.some((item) => item.status === "OVERDUE")

  await prisma.installmentAgreement.update({
    where: { id: installment.agreementId },
    data: {
      paidAmount,
      nextDueDate: nextDue?.dueDate ?? null,
      status: unpaid.length === 0 ? "COMPLETED" : hasOverdue ? "DEFAULTED" : "ACTIVE",
      accessSuspendedAt: hasOverdue ? undefined : null,
    },
  })
}

export async function markOverdueInstallments() {
  const now = new Date()
  const result = await prisma.installmentPayment.updateMany({
    where: {
      status: "PENDING",
      dueDate: { lt: now },
    },
    data: { status: "OVERDUE" },
  })

  const overdueAgreements = await prisma.installmentPayment.findMany({
    where: { status: "OVERDUE" },
    select: { agreementId: true },
    distinct: ["agreementId"],
  })

  if (overdueAgreements.length > 0) {
    await prisma.installmentAgreement.updateMany({
      where: { id: { in: overdueAgreements.map((item) => item.agreementId) } },
      data: { status: "DEFAULTED" },
    })
  }

  return result.count
}

export async function listAdminInstallmentPlans(): Promise<InstallmentPlanItem[]> {
  const plans = await prisma.installmentPlan.findMany({
    include: { course: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  })

  return plans.map((plan) => ({
    id: plan.id,
    courseId: plan.courseId,
    courseTitle: plan.course.title,
    label: plan.label,
    totalAmount: Number(plan.totalAmount),
    installmentCount: plan.installmentCount,
    intervalDays: plan.intervalDays,
    downPaymentPercent: plan.downPaymentPercent,
    isActive: plan.isActive,
  }))
}

export async function setInstallmentPlanActive(planId: string, isActive: boolean) {
  const plan = await prisma.installmentPlan.findUnique({
    where: { id: planId },
    include: { course: { select: { title: true } } },
  })
  if (!plan) throw Object.assign(new Error("Installment plan not found"), { code: "NOT_FOUND" })

  const updated = await prisma.installmentPlan.update({
    where: { id: planId },
    data: { isActive },
    include: { course: { select: { title: true } } },
  })

  return {
    id: updated.id,
    courseId: updated.courseId,
    courseTitle: updated.course.title,
    label: updated.label,
    totalAmount: Number(updated.totalAmount),
    installmentCount: updated.installmentCount,
    intervalDays: updated.intervalDays,
    downPaymentPercent: updated.downPaymentPercent,
    isActive: updated.isActive,
  } satisfies InstallmentPlanItem
}
