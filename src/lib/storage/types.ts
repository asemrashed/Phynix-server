export interface StoredFile {
  key: string
  publicPath: string
  size: number
}

export interface SaveFileInput {
  buffer: Buffer
  filename: string
  subdir: string
  contentType?: string
}

export interface StorageProvider {
  readonly name: string
  save(input: SaveFileInput): Promise<StoredFile>
  getPublicUrl(publicPath: string): string
}
