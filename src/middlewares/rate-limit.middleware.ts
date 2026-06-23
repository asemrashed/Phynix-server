import rateLimit from "express-rate-limit"

export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.PAYMENT_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many payment requests. Please try again later.",
    },
  },
})

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.WEBHOOK_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many webhook requests.",
    },
  },
})

export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.CONTACT_RATE_LIMIT_MAX || 3),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many contact requests. Please try again later.",
    },
  },
})
