import nodemailer from "nodemailer"

const RESEND_API = "https://api.resend.com/emails"

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  const from = process.env.EMAIL_FROM || "FX Prime Academy <noreply@fxprimeacademy.com>"
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase()

  if (provider === "gmail" || process.env.SMTP_HOST || process.env.SMTP_USER) {
    return sendEmailViaSmtp({ to, subject, html, from })
  }

  return sendEmailViaResend({ to, subject, html, from })
}

async function sendEmailViaResend({
  to,
  subject,
  html,
  from,
}: SendEmailOptions & { from: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.log(`[Email] To: ${to}`)
    console.log(`[Email] Subject: ${subject}`)
    console.log(`[Email] Body: ${html.replace(/<[^>]+>/g, "").slice(0, 200)}...`)
    return true
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      console.error("[Email] Resend error:", await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error("[Email] Failed to send:", err)
    return false
  }
}

async function sendEmailViaSmtp({
  to,
  subject,
  html,
  from,
}: SendEmailOptions & { from: string }): Promise<boolean> {
  const host = process.env.SMTP_HOST || "smtp.gmail.com"
  const port = Number(process.env.SMTP_PORT || 465)
  const secure = (process.env.SMTP_SECURE || String(port === 465)).toLowerCase() === "true"
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!user || !pass) {
    console.error("[Email] SMTP_USER/SMTP_PASS are required for SMTP provider")
    return false
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    })

    await transporter.sendMail({ from, to, subject, html })
    return true
  } catch (err) {
    console.error("[Email] SMTP send failed:", err)
    return false
  }
}

export async function sendWelcomeEmail(to: string, firstName: string) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  return sendEmail({
    to,
    subject: "Welcome to FX Prime Academy",
    html: `
      <h2>Welcome, ${firstName}!</h2>
      <p>Your account has been created successfully.</p>
      <p><a href="${frontendUrl}/courses">Browse our Forex courses</a> and start learning today.</p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendEnrollmentEmail(to: string, firstName: string, courseTitle: string) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  return sendEmail({
    to,
    subject: `Enrolled: ${courseTitle}`,
    html: `
      <h2>Enrollment Confirmed</h2>
      <p>Hi ${firstName}, you are now enrolled in <strong>${courseTitle}</strong>.</p>
      <p><a href="${frontendUrl}/dashboard/courses">Go to My Courses</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendCertificateRevokedEmail(
  to: string,
  firstName: string,
  courseTitle: string,
  reason: string
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  return sendEmail({
    to,
    subject: `Certificate Revoked: ${courseTitle}`,
    html: `
      <h2>Certificate Revoked</h2>
      <p>Hi ${firstName}, your certificate for <strong>${courseTitle}</strong> has been revoked.</p>
      <p>Reason: ${reason}</p>
      <p>If you believe this is an error, contact support.</p>
      <p><a href="${frontendUrl}/dashboard/certificates">View your certificates</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendCertificateFailedEmail(
  to: string,
  firstName: string,
  courseTitle: string
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  return sendEmail({
    to,
    subject: `Certificate issue — ${courseTitle}`,
    html: `
      <h2>Certificate Generation Issue</h2>
      <p>Hi ${firstName}, we could not generate your certificate for <strong>${courseTitle}</strong> right away.</p>
      <p>Our team will retry automatically. You can also contact support if this persists.</p>
      <p><a href="${frontendUrl}/dashboard/certificates">Check certificate status</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendCertificateEmail(
  to: string,
  firstName: string,
  courseTitle: string,
  certCode: string,
  courseSlug?: string
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  const reviewLink = courseSlug
    ? `${frontendUrl}/dashboard/courses/${courseSlug}?review=1`
    : `${frontendUrl}/dashboard/certificates`
  return sendEmail({
    to,
    subject: `Certificate Ready: ${courseTitle}`,
    html: `
      <h2>Congratulations, ${firstName}!</h2>
      <p>You completed <strong>${courseTitle}</strong>.</p>
      <p>Certificate: <strong>${certCode}</strong></p>
      <p><a href="${frontendUrl}/dashboard/certificates">Download your certificate</a></p>
      ${
        courseSlug
          ? `<p>We would love to hear from you — <a href="${reviewLink}">rate this course</a> and help fellow traders.</p>`
          : ""
      }
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendCourseReviewReminderEmail(
  to: string,
  firstName: string,
  courseTitle: string,
  courseSlug: string
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  const reviewLink = `${frontendUrl}/dashboard/courses/${courseSlug}?review=1`
  return sendEmail({
    to,
    subject: `How was ${courseTitle}?`,
    html: `
      <h2>Hi ${firstName},</h2>
      <p>You recently completed <strong>${courseTitle}</strong>.</p>
      <p>Your feedback helps other students and improves our courses.</p>
      <p><a href="${reviewLink}">Leave a quick review</a> — it only takes a minute.</p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendVerificationEmail(to: string, firstName: string, verifyUrl: string) {
  return sendEmail({
    to,
    subject: "Verify your FX Prime Academy email",
    html: `
      <h2>Hi ${firstName},</h2>
      <p>Please verify your email address to unlock all features.</p>
      <p><a href="${verifyUrl}">Verify Email</a></p>
      <p>This link expires in 24 hours.</p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

function orderDetailUrl(orderId: string) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  return `${frontendUrl}/order/${orderId}`
}

function formatMoney(currency: string, amount: number) {
  return `${currency === "BDT" ? "৳" : "$"}${amount}`
}

export async function sendOrderConfirmationEmail(
  to: string,
  firstName: string,
  orderCode: string,
  total: number,
  currency: string,
  orderId?: string
) {
  const trackUrl = orderId ? orderDetailUrl(orderId) : `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/orders`
  return sendEmail({
    to,
    subject: `Order Confirmed — ${orderCode}`,
    html: `
      <h2>Order Confirmed!</h2>
      <p>Hi ${firstName}, your order <strong>${orderCode}</strong> has been confirmed.</p>
      <p>Total: <strong>${formatMoney(currency, total)}</strong></p>
      <p><a href="${trackUrl}">Track your order</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendOrderProcessingEmail(
  to: string,
  firstName: string,
  orderCode: string,
  orderId: string
) {
  return sendEmail({
    to,
    subject: `Order Processing — ${orderCode}`,
    html: `
      <h2>We're preparing your order</h2>
      <p>Hi ${firstName}, order <strong>${orderCode}</strong> is now being processed.</p>
      <p><a href="${orderDetailUrl(orderId)}">View order details</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendOrderShippedEmail(
  to: string,
  firstName: string,
  orderCode: string,
  orderId: string,
  trackingNumber?: string | null
) {
  return sendEmail({
    to,
    subject: `Order Shipped — ${orderCode}`,
    html: `
      <h2>Your order is on the way</h2>
      <p>Hi ${firstName}, order <strong>${orderCode}</strong> has been shipped.</p>
      ${trackingNumber ? `<p>Tracking: <strong>${trackingNumber}</strong></p>` : ""}
      <p><a href="${orderDetailUrl(orderId)}">View order details</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendOrderDeliveredEmail(
  to: string,
  firstName: string,
  orderCode: string,
  orderId: string
) {
  return sendEmail({
    to,
    subject: `Order Delivered — ${orderCode}`,
    html: `
      <h2>Package delivered</h2>
      <p>Hi ${firstName}, order <strong>${orderCode}</strong> has been delivered.</p>
      <p><a href="${orderDetailUrl(orderId)}">View order details</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendOrderCancelledEmail(
  to: string,
  firstName: string,
  orderCode: string,
  orderId: string,
  refunded?: boolean
) {
  return sendEmail({
    to,
    subject: `Order Cancelled — ${orderCode}`,
    html: `
      <h2>Order cancelled</h2>
      <p>Hi ${firstName}, order <strong>${orderCode}</strong> was cancelled.</p>
      ${refunded ? "<p>A full refund will appear on your original payment method shortly.</p>" : ""}
      <p>Contact support if you have questions.</p>
      <p><a href="${orderDetailUrl(orderId)}">View order details</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendSubscriptionEmail(to: string, firstName: string, plan: string) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  return sendEmail({
    to,
    subject: `Welcome to ${plan} Plan`,
    html: `
      <h2>Subscription Active!</h2>
      <p>Hi ${firstName}, you're now on the <strong>${plan}</strong> plan.</p>
      <p><a href="${frontendUrl}/dashboard">Start learning</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendSubscriptionExpiryReminderEmail(
  to: string,
  firstName: string,
  plan: string,
  daysLeft: number,
  cancelScheduled: boolean
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  const renewUrl = `${frontendUrl}/pricing`
  return sendEmail({
    to,
    subject: `Your ${plan} plan expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    html: `
      <h2>Subscription Renewal Reminder</h2>
      <p>Hi ${firstName}, your <strong>${plan}</strong> plan expires in <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>.</p>
      ${cancelScheduled ? "<p>Your cancellation is scheduled — renew now to keep premium access.</p>" : "<p>Renew now to avoid losing premium content access.</p>"}
      <p><a href="${renewUrl}">Renew or Upgrade</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendSubscriptionExpiredEmail(
  to: string,
  firstName: string,
  plan: string,
  graceDays: number
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  return sendEmail({
    to,
    subject: `Your ${plan} plan has expired`,
    html: `
      <h2>Subscription Expired</h2>
      <p>Hi ${firstName}, your <strong>${plan}</strong> plan has expired.</p>
      <p>You have a <strong>${graceDays}-day grace period</strong> to renew before premium access is removed.</p>
      <p><a href="${frontendUrl}/pricing">Renew Now</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendSubscriptionCancelledEmail(
  to: string,
  firstName: string,
  plan: string,
  expiresAt: string
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  return sendEmail({
    to,
    subject: `Cancellation scheduled — ${plan} plan`,
    html: `
      <h2>Cancellation Confirmed</h2>
      <p>Hi ${firstName}, your <strong>${plan}</strong> plan will end on <strong>${new Date(expiresAt).toLocaleDateString()}</strong>.</p>
      <p>You keep full access until then. Changed your mind?</p>
      <p><a href="${frontendUrl}/dashboard/settings">Reactivate in Settings</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendInstallmentDueReminderEmail(
  to: string,
  firstName: string,
  courseTitle: string,
  amount: number,
  dueDate: string,
  daysLeft: number
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  const dueLabel = new Date(dueDate).toLocaleDateString("en-US", {
    timeZone: process.env.MEETING_TIMEZONE || "Asia/Dhaka",
  })
  return sendEmail({
    to,
    subject: `Installment due${daysLeft <= 1 ? " today" : ` in ${daysLeft} days`} — ${courseTitle}`,
    html: `
      <h2>Installment Payment Reminder</h2>
      <p>Hi ${firstName}, your installment for <strong>${courseTitle}</strong> is due${daysLeft <= 1 ? " today" : ` in <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>`}.</p>
      <p>Amount: <strong>৳${amount.toLocaleString()}</strong></p>
      <p>Due date: <strong>${dueLabel}</strong></p>
      <p><a href="${frontendUrl}/dashboard/installments">Pay installment</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendInstallmentOverdueEmail(
  to: string,
  firstName: string,
  courseTitle: string,
  amount: number,
  dueDate: string,
  graceDaysLeft: number
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  const dueLabel = new Date(dueDate).toLocaleDateString("en-US", {
    timeZone: process.env.MEETING_TIMEZONE || "Asia/Dhaka",
  })
  return sendEmail({
    to,
    subject: `Overdue installment — ${courseTitle}`,
    html: `
      <h2>Installment Overdue</h2>
      <p>Hi ${firstName}, your installment for <strong>${courseTitle}</strong> is overdue.</p>
      <p>Amount: <strong>৳${amount.toLocaleString()}</strong></p>
      <p>Due date was: <strong>${dueLabel}</strong></p>
      ${
        graceDaysLeft > 0
          ? `<p>Pay within <strong>${graceDaysLeft} day${graceDaysLeft === 1 ? "" : "s"}</strong> to avoid losing course access.</p>`
          : "<p>Your course access has been suspended until payment is received.</p>"
      }
      <p><a href="${frontendUrl}/dashboard/installments">Pay now</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendMentorBookingEmail(
  to: string,
  firstName: string,
  mentorName: string,
  scheduledAt: string,
  zoomUrl?: string,
  consultationTypeLabel?: string
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  const sessionLabel = consultationTypeLabel ?? "Mentor session"
  return sendEmail({
    to,
    subject: `${sessionLabel} Booked — ${mentorName}`,
    html: `
      <h2>Session Confirmed!</h2>
      <p>Hi ${firstName}, your ${sessionLabel.toLowerCase()} with <strong>${mentorName}</strong> is booked.</p>
      <p>Date: <strong>${new Date(scheduledAt).toLocaleString("en-US", { timeZone: process.env.MEETING_TIMEZONE || "Asia/Dhaka" })}</strong></p>
      ${zoomUrl ? `<p>Your join link will be available 15 minutes before the session in <a href="${frontendUrl}/dashboard/mentorship">Mentorship</a>.</p>` : `<p>Your join link will be available 15 minutes before the session in <a href="${frontendUrl}/dashboard/mentorship">Mentorship</a>.</p>`}
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendMentorReminderEmail(
  to: string,
  firstName: string,
  mentorName: string,
  scheduledAt: string,
  hoursBefore: 24 | 1
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  const label = hoursBefore === 24 ? "24 hours" : "1 hour"
  return sendEmail({
    to,
    subject: `Reminder: Mentor session in ${label} — ${mentorName}`,
    html: `
      <h2>Session Reminder</h2>
      <p>Hi ${firstName}, your mentorship session with <strong>${mentorName}</strong> starts in ${label}.</p>
      <p>When: <strong>${new Date(scheduledAt).toLocaleString("en-US", { timeZone: process.env.MEETING_TIMEZONE || "Asia/Dhaka" })}</strong></p>
      <p><a href="${frontendUrl}/dashboard/mentorship">View booking & join link</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendMentorCancelledEmail(
  to: string,
  firstName: string,
  mentorName: string,
  scheduledAt: string
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  return sendEmail({
    to,
    subject: `Mentor Session Cancelled — ${mentorName}`,
    html: `
      <h2>Session Cancelled</h2>
      <p>Hi ${firstName}, your session with <strong>${mentorName}</strong> on <strong>${new Date(scheduledAt).toLocaleString("en-US", { timeZone: process.env.MEETING_TIMEZONE || "Asia/Dhaka" })}</strong> has been cancelled.</p>
      <p><a href="${frontendUrl}/dashboard/mentorship">Book another slot</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendMentorRescheduledEmail(
  to: string,
  firstName: string,
  mentorName: string,
  scheduledAt: string
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  return sendEmail({
    to,
    subject: `Mentor Session Rescheduled — ${mentorName}`,
    html: `
      <h2>Session Rescheduled</h2>
      <p>Hi ${firstName}, your session with <strong>${mentorName}</strong> has been moved.</p>
      <p>New time: <strong>${new Date(scheduledAt).toLocaleString("en-US", { timeZone: process.env.MEETING_TIMEZONE || "Asia/Dhaka" })}</strong></p>
      <p><a href="${frontendUrl}/dashboard/mentorship">View updated booking</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendLiveSessionCancelledEmail(
  to: string,
  firstName: string,
  sessionTitle: string,
  scheduledAt: string
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  return sendEmail({
    to,
    subject: `Session Cancelled — ${sessionTitle}`,
    html: `
      <h2>Live Session Cancelled</h2>
      <p>Hi ${firstName},</p>
      <p>The live session <strong>${sessionTitle}</strong> scheduled for <strong>${scheduledAt}</strong> has been cancelled.</p>
      <p>Check <a href="${frontendUrl}/live">Live Support Desk</a> for other upcoming sessions.</p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendLiveSessionRegisteredEmail(
  to: string,
  firstName: string,
  sessionTitle: string,
  scheduledAt: string
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  return sendEmail({
    to,
    subject: `Registered — ${sessionTitle}`,
    html: `
      <h2>You're Registered!</h2>
      <p>Hi ${firstName}, you're registered for <strong>${sessionTitle}</strong>.</p>
      <p>When: <strong>${scheduledAt}</strong></p>
      <p>Your join link will be available 15 minutes before the session on the <a href="${frontendUrl}/live">Live Support Desk</a>.</p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendLiveSessionReminderEmail(
  to: string,
  firstName: string,
  sessionTitle: string,
  scheduledAt: string,
  hoursBefore: 24 | 1
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  const label = hoursBefore === 24 ? "24 hours" : "1 hour"
  return sendEmail({
    to,
    subject: `Reminder: Live session in ${label} — ${sessionTitle}`,
    html: `
      <h2>Session Reminder</h2>
      <p>Hi ${firstName}, <strong>${sessionTitle}</strong> starts in ${label}.</p>
      <p>When: <strong>${scheduledAt}</strong></p>
      <p><a href="${frontendUrl}/live">Open Live Support Desk</a> to join when the link opens.</p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendDigitalProductEmail(to: string, firstName: string, productTitle: string) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  return sendEmail({
    to,
    subject: `Purchase Confirmed — ${productTitle}`,
    html: `
      <h2>Product Purchased!</h2>
      <p>Hi ${firstName}, <strong>${productTitle}</strong> is now in your library.</p>
      <p><a href="${frontendUrl}/dashboard/products">Download now</a></p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendRefundConfirmationEmail(
  to: string,
  firstName: string,
  itemLabel: string,
  amount: number,
  currency: string,
  refundType: "full" | "partial"
) {
  const symbol = currency === "BDT" ? "৳" : "$"
  return sendEmail({
    to,
    subject: `${refundType === "full" ? "Refund" : "Partial refund"} confirmed — ${itemLabel}`,
    html: `
      <h2>Refund Processed</h2>
      <p>Hi ${firstName}, a <strong>${refundType}</strong> refund of <strong>${symbol}${amount}</strong> has been issued for <strong>${itemLabel}</strong>.</p>
      <p>Access related to this purchase has been ${refundType === "full" ? "revoked" : "kept (partial refund)"}.</p>
      <p>If you have questions, contact support.</p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendEmail({
    to,
    subject: "Reset your FX Prime Academy password",
    html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>If you didn't request this, ignore this email.</p>
      <p>— FX Prime Academy Team</p>
    `,
  })
}

interface ContactInquiryEmailData {
  id: string
  name: string
  email: string
  phone: string | null
  subjectLabel: string
  message: string
  userId: string | null
  createdAt: string
}

export async function sendContactInquiryNotificationEmail({
  to,
  inquiry,
}: {
  to: string
  inquiry: ContactInquiryEmailData
}) {
  const adminUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/admin/inquiries`
  const phoneLine = inquiry.phone ? `<p><strong>Phone:</strong> ${inquiry.phone}</p>` : ""
  const userLine = inquiry.userId
    ? `<p><strong>User ID:</strong> ${inquiry.userId}</p>`
    : "<p><em>Submitted by a guest (not logged in)</em></p>"

  return sendEmail({
    to,
    subject: `[Contact] ${inquiry.subjectLabel} — ${inquiry.name}`,
    html: `
      <h2>New contact inquiry</h2>
      <p><strong>From:</strong> ${inquiry.name} &lt;${inquiry.email}&gt;</p>
      ${phoneLine}
      <p><strong>Subject:</strong> ${inquiry.subjectLabel}</p>
      ${userLine}
      <p><strong>Message:</strong></p>
      <p>${inquiry.message.replace(/\n/g, "<br>")}</p>
      <p><a href="${adminUrl}">View in admin panel</a></p>
      <p style="color:#666;font-size:12px;">Inquiry ID: ${inquiry.id}</p>
    `,
  })
}

export async function sendContactInquiryAutoReplyEmail({
  to,
  name,
  subjectLabel,
}: {
  to: string
  name: string
  subjectLabel: string
}) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"

  return sendEmail({
    to,
    subject: "We received your message — FX Prime Academy",
    html: `
      <h2>Thanks for contacting us, ${name}!</h2>
      <p>We received your message about <strong>${subjectLabel}</strong>.</p>
      <p>Our support team typically replies within <strong>24–48 hours</strong> during Bangladesh business hours (Mon–Sat).</p>
      <p>While you wait, you can browse <a href="${frontendUrl}/courses">our courses</a> or read our <a href="${frontendUrl}/refund-policy">refund policy</a>.</p>
      <p>— FX Prime Academy Support</p>
    `,
  })
}
