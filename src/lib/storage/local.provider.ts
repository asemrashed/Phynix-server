import fs from "fs"
import path from "path"
import type { SaveFileInput, StorageProvider, StoredFile } from "./types"

const UPLOAD_ROOT = path.join(process.cwd(), "uploads")

export class LocalStorageProvider implements StorageProvider {
  readonly name = "local"

  async save(input: SaveFileInput): Promise<StoredFile> {
    const filename = path.basename(input.filename)
    const dir = path.join(UPLOAD_ROOT, input.subdir)

    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, filename), input.buffer)

    const publicPath = `/uploads/${input.subdir}/${filename}`
    return {
      key: `${input.subdir}/${filename}`,
      publicPath,
      size: input.buffer.length,
    }
  }

  getPublicUrl(publicPath: string): string {
    const base =
      process.env.API_PUBLIC_URL?.replace(/\/api\/v1$/, "") ||
      `http://localhost:${process.env.PORT || 4000}`
    return `${base}${publicPath}`
  }
}

export const localStorageProvider = new LocalStorageProvider()
