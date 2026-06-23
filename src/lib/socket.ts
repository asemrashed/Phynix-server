import type { Server as HttpServer } from "http"
import jwt from "jsonwebtoken"
import { Server } from "socket.io"
import type { AuthPayload } from "../middlewares/auth.middleware"
import { getAllowedOrigins } from "./cors"
import { setNotificationIo } from "./notification-emit"

export function initSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
    path: "/socket.io",
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) {
      next(new Error("Authentication required"))
      return
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
      socket.data.userId = payload.userId
      next()
    } catch {
      next(new Error("Invalid token"))
    }
  })

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string
    socket.join(`user:${userId}`)
  })

  setNotificationIo(io)
  return io
}
