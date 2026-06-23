/** Parse JWT-style expiry strings (e.g. 15m, 3d) to seconds. */
function parseJwtExpiryToSeconds(expiry: string): number {
  const match = expiry.trim().match(/^(\d+)([smhd])$/i)
  if (!match) return 3 * 86400
  const n = parseInt(match[1], 10)
  switch (match[2].toLowerCase()) {
    case "s":
      return n
    case "m":
      return n * 60
    case "h":
      return n * 3600
    case "d":
      return n * 86400
    default:
      return 3 * 86400
  }
}

export const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "3d"
export const JWT_REFRESH_EXPIRY_DAYS = Number(process.env.JWT_REFRESH_EXPIRY_DAYS || 7)
export const JWT_ACCESS_EXPIRY_SECONDS = parseJwtExpiryToSeconds(JWT_ACCESS_EXPIRY)
export const JWT_REFRESH_EXPIRY_SECONDS = JWT_REFRESH_EXPIRY_DAYS * 86400
