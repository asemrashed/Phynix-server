export interface PaginationParams {
  page: number
  pageSize: number
  skip: number
}

export function parsePagination(
  query: { page?: unknown; pageSize?: unknown },
  defaults?: { page?: number; pageSize?: number }
): PaginationParams {
  const page = Math.max(1, Number(query.page) || defaults?.page || 1)
  const pageSize = Math.min(
    100,
    Math.max(1, Number(query.pageSize) || defaults?.pageSize || 20)
  )
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export function paginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
) {
  return { items, total, page, pageSize }
}

export function parseSearch(query: { search?: unknown }): string | undefined {
  if (typeof query.search !== "string") return undefined
  const trimmed = query.search.trim()
  return trimmed || undefined
}

export function parseFilterParam(query: { [key: string]: unknown }, key: string): string | undefined {
  const value = query[key]
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}
