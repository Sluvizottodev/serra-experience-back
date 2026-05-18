export function getPaginationParams(page = 1, limit = 10) {
  const take = Math.min(limit, 100)
  const skip = (page - 1) * take
  return { take, skip }
}

export function buildPaginationMeta(total: number, page: number, take: number) {
  return {
    total,
    page,
    limit: take,
    totalPages: Math.ceil(total / take),
  }
}
