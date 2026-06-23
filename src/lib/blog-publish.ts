export function resolveBlogPublishState(input: {
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  publishedAt?: Date | string | null
  publishNow?: boolean
}) {
  if (input.status === "ARCHIVED") {
    return { status: "ARCHIVED" as const, publishedAt: undefined }
  }

  const scheduled = input.publishedAt ? new Date(input.publishedAt) : null
  const now = new Date()

  if (input.publishNow || input.status === "PUBLISHED") {
    if (scheduled && scheduled > now) {
      return { status: "DRAFT" as const, publishedAt: scheduled }
    }
    return {
      status: "PUBLISHED" as const,
      publishedAt: scheduled && scheduled <= now ? scheduled : now,
    }
  }

  if (scheduled && scheduled > now) {
    return { status: "DRAFT" as const, publishedAt: scheduled }
  }

  return { status: "DRAFT" as const, publishedAt: null }
}

export function isScheduledPost(status: string, publishedAt: Date | null) {
  return status === "DRAFT" && publishedAt !== null && publishedAt > new Date()
}
