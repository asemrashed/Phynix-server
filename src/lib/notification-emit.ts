import type { Server } from "socket.io"
import type { NotificationSocketPayload } from "@fxprime/types"

let io: Server | null = null

export function setNotificationIo(server: Server) {
  io = server
}

export function emitNotificationUpdate(userId: string, payload: NotificationSocketPayload) {
  io?.to(`user:${userId}`).emit("notification:update", payload)
}
