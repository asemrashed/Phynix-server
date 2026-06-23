const DEFAULT_TTL = 60

const store = new Map<string, { value: string; expiresAt: number }>()

function cleanExpired() {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt < now) store.delete(key)
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  cleanExpired()
  const entry = store.get(key)
  if (!entry || entry.expiresAt < Date.now()) {
    store.delete(key)
    return null
  }
  return JSON.parse(entry.value) as T
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds = DEFAULT_TTL
): Promise<void> {
  cleanExpired()
  store.set(key, {
    value: JSON.stringify(value),
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

export async function invalidateCached(key: string): Promise<void> {
  store.delete(key)
}
