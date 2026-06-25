import type { VideoProvider } from "@fxprime/types"

export function parseYoutubeId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed

  const patterns = [
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = trimmed.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}

export function resolveLessonVideo(lesson: {
  videoProvider: string | null
  videoRef: string | null
}): { provider: VideoProvider; ref: string | null } {
  const provider = (lesson.videoProvider as VideoProvider | null) || "YOUTUBE"

  if (!lesson.videoRef?.trim()) {
    return { provider, ref: null }
  }

  const raw = lesson.videoRef.trim()
  if (provider === "YOUTUBE") {
    const videoId = parseYoutubeId(raw)
    if (!videoId) {
      return { provider, ref: null }
    }
    return { provider, ref: videoId }
  }

  return { provider, ref: raw }
}

export function buildYoutubeEmbedUrl(videoRef: string, startSeconds?: number): string {
  const videoId = parseYoutubeId(videoRef) || videoRef
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    enablejsapi: "1",
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  })

  if (startSeconds && startSeconds > 0) {
    params.set("start", String(Math.floor(startSeconds)))
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}

export function getVideoMimeType(storageKey: string): string {
  const ext = storageKey.split(".").pop()?.toLowerCase()
  if (ext === "webm") return "video/webm"
  if (ext === "mov") return "video/quicktime"
  return "video/mp4"
}
