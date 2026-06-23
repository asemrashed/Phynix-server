import { getCached, setCached } from "../lib/cache"

const VIMEO_CACHE_TTL = 24 * 60 * 60

interface VimeoVideoMeta {
  privacyHash: string | null
}

export async function getVimeoPrivacyHash(vimeoId: string): Promise<string | null> {
  const cacheKey = `vimeo_meta:${vimeoId}`

  const cached = await getCached<VimeoVideoMeta>(cacheKey)
  if (cached) {
    return cached.privacyHash
  }

  const accessToken = process.env.VIMEO_ACCESS_TOKEN
  if (!accessToken) {
    return null
  }

  try {
    const res = await fetch(`https://api.vimeo.com/videos/${vimeoId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.vimeo.*+json;version=3.4",
      },
    })

    if (!res.ok) {
      return null
    }

    const data = (await res.json()) as {
      link?: string
      embed?: { html?: string }
    }

    let privacyHash: string | null = null

    const linkMatch = data.link?.match(/vimeo\.com\/\d+\/([a-zA-Z0-9]+)/)
    if (linkMatch) {
      privacyHash = linkMatch[1]
    } else if (data.embed?.html) {
      const embedMatch = data.embed.html.match(/[?&]h=([a-zA-Z0-9]+)/)
      privacyHash = embedMatch?.[1] ?? null
    }

    await setCached(cacheKey, { privacyHash } satisfies VimeoVideoMeta, VIMEO_CACHE_TTL)

    return privacyHash
  } catch {
    return null
  }
}

export async function buildVimeoEmbedUrl(
  vimeoId: string,
  options?: { startSeconds?: number; privacyHash?: string | null }
): Promise<string> {
  const hash = options?.privacyHash ?? (await getVimeoPrivacyHash(vimeoId))
  const params = new URLSearchParams({
    badge: "0",
    autopause: "0",
    title: "0",
    byline: "0",
    portrait: "0",
    dnt: "1",
  })

  if (hash) {
    params.set("h", hash)
  }

  const base = `https://player.vimeo.com/video/${vimeoId}?${params.toString()}`
  const start = options?.startSeconds
  if (start && start > 0) {
    return `${base}#t=${Math.floor(start)}s`
  }
  return base
}
