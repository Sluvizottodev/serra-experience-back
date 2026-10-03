import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Exercita previewQuote() inteiro — o caminho que o site chama — com o banco
 * mockado e a rede REAL, sem OPENROUTE_API_KEY. Valida que o campo
 * distanceApproximate chega na resposta da API, que é o que a mensagem de
 * WhatsApp usa para escrever "(aproximada)".
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    settings: { findUnique: vi.fn() },
    driverProfile: { count: vi.fn() },
    tripParameter: { findMany: vi.fn() },
  },
}))

vi.mock('../../common/config/prisma', () => ({ prisma: prismaMock }))

describe('previewQuote sem OPENROUTE_API_KEY', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.OPENROUTE_API_KEY
    prismaMock.settings.findUnique.mockResolvedValue({
      basePricePerKm: 3.5,
      commissionRate: 0.1,
    })
    prismaMock.driverProfile.count.mockResolvedValue(2)
    prismaMock.tripParameter.findMany.mockResolvedValue([])
  })

  it(
    'devolve distância real e marca distanceApproximate=false',
    async () => {
      const { QuoteService } = await import('./quote.service')
      const svc = new QuoteService()

      const res: any = await svc.previewQuote({
        originAddress: 'Nova Friburgo , RJ',
        destinationAddress: 'Conservatoria, RJ',
        scheduledAt: new Date('2026-12-07T11:00:00.000Z').toISOString(),
      } as any)

      // Era 199.2 km antes da correção.
      expect(res.distanceKm).toBeGreaterThan(230)
      expect(res.distanceKm).toBeLessThan(260)
      expect(res.distanceMethod).toBe('route')
      expect(res.distanceApproximate).toBe(false)
      expect(res.distanceError).toBeNull()

      // Com preço base configurado, a faixa de valor sai calculada.
      expect(res.estimatedRange).not.toBeNull()
      expect(res.estimatedRange.minTotal).toBeGreaterThan(0)
      expect(res.estimatedRange.maxTotal).toBeGreaterThan(res.estimatedRange.minTotal)
    },
    30_000,
  )

  it(
    'endereço inválido: devolve distanceError sem derrubar o endpoint',
    async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { QuoteService } = await import('./quote.service')
      const svc = new QuoteService()

      const res: any = await svc.previewQuote({
        originAddress: 'Nova Friburgo, RJ',
        destinationAddress: 'Zzzqqq Inexistente 00000, RJ',
        scheduledAt: new Date('2026-12-07T11:00:00.000Z').toISOString(),
      } as any)

      // Não lança: responde com a distância nula e o motivo.
      expect(res.distanceKm).toBeNull()
      expect(res.distanceError).toBeTruthy()
      expect(res.estimatedRange).toBeNull()
      expect(res.note).toContain('distancia')

      warn.mockRestore()
    },
    30_000,
  )
})
