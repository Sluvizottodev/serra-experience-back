import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// Em serverless (Vercel), cada instância/cold start abre seu próprio pool de
// conexões diretas ao Postgres. Sem um limite baixo por instância, poucas
// invocações concorrentes já somam mais conexões do que o pool do Supabase
// (15, em session mode) suporta, mesmo com tráfego real baixo.
function withConnectionLimit(url: string): string {
  const [base, query] = url.split('?')
  const params = new URLSearchParams(query)
  const limit = process.env.NODE_ENV === 'production' ? '1' : '3'
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
