/**
 * Public-facing site URL for links/QR codes (certificates, emails).
 * Prefer PUBLIC_SITE_URL in production so PDF QR codes are scannable off-device.
 */
export function getPublicSiteUrl(): string {
  const url =
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    "http://localhost:3000"
  return url.replace(/\/$/, "")
}

export function getCertificateVerifyUrl(certCode: string, baseUrl?: string): string {
  const root = (baseUrl?.replace(/\/$/, "") || getPublicSiteUrl()).trim()
  return `${root}/verify/${encodeURIComponent(certCode)}`
}

export function isAllowedPublicOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false

    const candidate = `${parsed.protocol}//${parsed.host}`
    const allowed = new Set<string>([
      getPublicSiteUrl(),
      process.env.FRONTEND_URL?.replace(/\/$/, "") || "",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      ...(process.env.CORS_ORIGINS?.split(",").map((o) => o.trim().replace(/\/$/, "")) ?? []),
    ].filter(Boolean))

    return allowed.has(candidate)
  } catch {
    return false
  }
}
