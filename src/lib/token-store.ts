import { randomBytes } from "crypto"

const memoryStore = new Map<string, { value: string; expiresAt: number }>()

function cleanMemory() {
  const now = Date.now()
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt < now) memoryStore.delete(key)
  }
}

export async function storeToken(
  prefix: string,
  value: string,
  ttlSeconds: number
): Promise<string> {
  const token = randomBytes(32).toString("hex")
  const key = `${prefix}:${token}`

  cleanMemory()
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  })

  return token
}

export async function getTokenValue(prefix: string, token: string): Promise<string | null> {
  const key = `${prefix}:${token}`

  cleanMemory()
  const entry = memoryStore.get(key)
  if (!entry || entry.expiresAt < Date.now()) {
    memoryStore.delete(key)
    return null
  }
  return entry.value
}

export async function deleteToken(prefix: string, token: string): Promise<void> {
  memoryStore.delete(`${prefix}:${token}`)
}
