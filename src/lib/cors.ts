export function getAllowedOrigins(): string[] {
  const origins = new Set<string>()

  const frontend = process.env.FRONTEND_URL?.trim()
  if (frontend) origins.add(frontend)

  const extra = process.env.CORS_ORIGINS?.trim()
  if (extra) {
    for (const origin of extra.split(",")) {
      const value = origin.trim()
      if (value) origins.add(value)
    }
  }

  if (origins.size === 0) {
    origins.add("http://localhost:3000")
  }

  return [...origins]
}
