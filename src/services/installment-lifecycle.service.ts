import { prisma } from "../lib/prisma"
import {
  getInstallmentReminderFlags,
  INSTALLMENT_ACCESS_GRACE_DAYS,
  INSTALLMENT_REMINDER_DAYS_BEFORE,
  type InstallmentReminderFlags,
} from "../lib/installment-utils"
import {
  sendInstallmentDueReminderEmail,
  sendInstallmentOverdueEmail,
} from "./email.service"
import { createNotification } from "./notification.service"

async function getStudentContact(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { email: true } } },
  })
  if (!student) return null
  return { email: student.user.email, firstName: student.firstName }
}

async function getCourseTitle(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true },
  })
  return course?.title || "Course"
}

export async function suspendOverdueInstallmentAccess() {
  const graceMs = INSTALLMENT_ACCESS_GRACE_DAYS * 24 * 60 * 60 * 1000
  const suspendBefore = new Date(Date.now() - graceMs)

  const overdueInstallments = await prisma.installmentPayment.findMany({
    where: {
      status: "OVERDUE",
      dueDate: { lt: suspendBefore },
      agreement: { accessSuspendedAt: null },
    },
    select: { agreementId: true },
    distinct: ["agreementId"],
  })

  if (overdueInstallments.length === 0) return 0

  await prisma.installmentAgreement.updateMany({
    where: { id: { in: overdueInstallments.map((item) => item.agreementId) } },
    data: { accessSuspendedAt: new Date(), status: "DEFAULTED" },
  })

  return overdueInstallments.length
}

export async function processInstallmentReminders() {
  const now = new Date()
  let sent = 0

  const pendingInstallments = await prisma.installmentPayment.findMany({
    where: { status: { in: ["PENDING", "OVERDUE"] } },
    include: {
      agreement: {
        include: { student: { include: { user: { select: { id: true, email: true } } } } },
      },
    },
  })

  for (const installment of pendingInstallments) {
    const flags = getInstallmentReminderFlags(installment.reminderFlags)
    const contact = await getStudentContact(installment.agreement.studentId)
    if (!contact) continue

    const courseTitle = await getCourseTitle(installment.agreement.courseId)
    const daysUntilDue = Math.ceil(
      (installment.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    )
    const updatedFlags: InstallmentReminderFlags = { ...flags }
    const amount = Number(installment.amount)
    const dueDateIso = installment.dueDate.toISOString()
    const dashboardUrl = "/dashboard/installments"

    if (
      installment.status === "PENDING" &&
      daysUntilDue <= INSTALLMENT_REMINDER_DAYS_BEFORE &&
      daysUntilDue > 1 &&
      !flags.threeDay
    ) {
      await sendInstallmentDueReminderEmail(
        contact.email,
        contact.firstName,
        courseTitle,
        amount,
        dueDateIso,
        daysUntilDue
      )
      updatedFlags.threeDay = now.toISOString()
      await prisma.installmentPayment.update({
        where: { id: installment.id },
        data: { reminderFlags: updatedFlags },
      })
      await createNotification(
        installment.agreement.student.user.id,
        "PAYMENT_REMINDER",
        "Installment due soon",
        `Installment ${installment.installmentNo} for ${courseTitle} is due in ${daysUntilDue} days`,
        dashboardUrl
      )
      sent++
      continue
    }

    if (
      installment.status === "PENDING" &&
      daysUntilDue <= 1 &&
      daysUntilDue >= 0 &&
      !flags.dueDay
    ) {
      await sendInstallmentDueReminderEmail(
        contact.email,
        contact.firstName,
        courseTitle,
        amount,
        dueDateIso,
        Math.max(daysUntilDue, 0)
      )
      updatedFlags.dueDay = now.toISOString()
      await prisma.installmentPayment.update({
        where: { id: installment.id },
        data: { reminderFlags: updatedFlags },
      })
      await createNotification(
        installment.agreement.student.user.id,
        "PAYMENT_REMINDER",
        "Installment due today",
        `Installment ${installment.installmentNo} for ${courseTitle} is due today`,
        dashboardUrl
      )
      sent++
      continue
    }

    if (installment.status === "OVERDUE" && !flags.overdue) {
      const daysOverdue = Math.ceil(
        (now.getTime() - installment.dueDate.getTime()) / (24 * 60 * 60 * 1000)
      )
      const graceLeft = Math.max(0, INSTALLMENT_ACCESS_GRACE_DAYS - daysOverdue)

      await sendInstallmentOverdueEmail(
        contact.email,
        contact.firstName,
        courseTitle,
        amount,
        dueDateIso,
        graceLeft
      )
      updatedFlags.overdue = now.toISOString()
      await prisma.installmentPayment.update({
        where: { id: installment.id },
        data: { reminderFlags: updatedFlags },
      })
      await createNotification(
        installment.agreement.student.user.id,
        "PAYMENT_REMINDER",
        "Installment overdue",
        graceLeft > 0
          ? `Pay installment ${installment.installmentNo} within ${graceLeft} day(s) to keep course access`
          : `Course access for ${courseTitle} has been suspended due to overdue payment`,
        dashboardUrl
      )
      sent++
    }
  }

  return sent
}
