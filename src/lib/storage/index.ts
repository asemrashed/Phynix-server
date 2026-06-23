import type { StorageProvider } from "./types"
import { localStorageProvider } from "./local.provider"
import { s3StorageProvider } from "./s3.provider"

let cached: StorageProvider | null = null

export function getStorageProvider(): StorageProvider {
  if (cached) return cached

  const preferred = (process.env.STORAGE_PROVIDER || "local").toLowerCase()
  cached = preferred === "s3" ? s3StorageProvider : localStorageProvider
  return cached
}

export function getUploadPublicUrl(relativePath: string): string {
  return getStorageProvider().getPublicUrl(relativePath)
}

export type { StorageProvider, StoredFile, SaveFileInput } from "./types"
