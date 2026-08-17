import { vi } from 'vitest'

// Mock mínimo do Prisma Client: só os métodos usados pelos testes atuais.
// Cada teste ajusta os retornos via mockResolvedValueOnce/mockReturnValue conforme o cenário.
export const prismaMock = {
  trip: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  driverProfile: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  quote: {
    update: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  review: {
    findUnique: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn(),
  },
  $transaction: vi.fn(),
}

export function resetPrismaMock() {
  vi.clearAllMocks()
}
