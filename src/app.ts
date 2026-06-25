import path from "path"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import rateLimit from "express-rate-limit"
import morgan from "morgan"
import routes from "./routes"
import { errorMiddleware } from "./middlewares/error.middleware"
import { getAllowedOrigins } from "./lib/cors"
import { contactLimiter } from "./middlewares/rate-limit.middleware"

export function createApp() {
  const app = express()
  const allowedOrigins = getAllowedOrigins()

  app.set("trust proxy", 1)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  )
  app.get("/", (_req, res) => {
    res.type("text/plain").send("server is working")
  })
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, origin ?? allowedOrigins[0])
          return
        }
        // Unknown origin (e.g. payment-gateway redirect callbacks like
        // SSLCommerz): don't throw — that would surface as a 500
        // INTERNAL_ERROR on /sslcommerz/* callbacks. Just omit CORS
        // headers; these are top-level navigations that don't need them.
        callback(null, false)
      },
      credentials: true,
    })
  )
  app.use(cookieParser())
  app.use(
    morgan("dev", {
      skip: (req) => req.url === "/" || req.url === "/api/v1/health",
    })
  )
  app.use("/uploads", (req, res, next) => {
    // Allow phynixeducation.com to embed thumbnails/avatars from api.phynixeducation.com
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin")
    if (req.path.startsWith("/videos") || req.path.startsWith("/videos/")) {
      return res.status(403).json({ success: false, error: "Forbidden" })
    }
    next()
  })
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")))

  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })

  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
  })

  app.use("/api/v1", generalLimiter)
  app.use("/api/v1/auth/login", authLimiter)
  app.use("/api/v1/auth/register", authLimiter)
  app.use("/api/v1/contact", contactLimiter)
  app.use("/api/v1", routes)
  app.use(errorMiddleware)

  return app
}
