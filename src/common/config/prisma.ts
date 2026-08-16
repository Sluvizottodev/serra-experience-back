import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function withConnectionLimit(url: string): string {
  const [base, query] = url.split('?')
  const params = new URLSearchParams(query)
  const isPooler = base.includes(':6543') || params.get('pgbouncer') === 'true'
  if (isPooler && !params.has('pgbouncer')) params.set('pgbouncer', 'true')
  const limit = process.env.NODE_ENV === 'production' ? '1' : '5'
  if (!params.has('connection_limit')) params.set('connection_limit', limit)
  if (!params.has('pool_timeout')) params.set('pool_timeout', '10')

  return `${base}?${params.toString()}`
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: { url: withConnectionLimit(process.env.DATABASE_URL!) },
    },
  })

globalForPrisma.prisma = prisma
