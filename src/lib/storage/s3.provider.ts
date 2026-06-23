import type { SaveFileInput, StorageProvider, StoredFile } from "./types"

/**
 * S3/R2 provider stub — implement when cloud bucket is provisioned.
 * Set STORAGE_PROVIDER=s3 and configure AWS_* / S3_* env vars.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3"

  private ensureConfigured() {
    const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET
    if (!bucket) {
      throw Object.assign(new Error("S3 storage is not configured"), {
        code: "STORAGE_NOT_CONFIGURED",
      })
    }
    return bucket
  }

  async save(_input: SaveFileInput): Promise<StoredFile> {
    this.ensureConfigured()
    throw Object.assign(new Error("S3 upload not implemented yet — use STORAGE_PROVIDER=local"), {
      code: "NOT_IMPLEMENTED",
    })
  }

  getPublicUrl(publicPath: string): string {
    const cdn = process.env.S3_PUBLIC_URL || process.env.CDN_URL
    if (cdn) return `${cdn.replace(/\/$/, "")}${publicPath}`
    return publicPath
  }
}

export const s3StorageProvider = new S3StorageProvider()
