import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getRouteDistance, normalizeAddress } from './geo'

/**
 * Estes testes batem na rede de verdade (Nominatim/Photon/OSRM) porque é
 * exatamente isso que precisa ser validado: o comportamento sem
 * OPENROUTE_API_KEY, que é a configuração de produção hoje.
 *
 * Rotas de referência medidas em 2026-10-03 via OSRM:
 *   Nova Friburgo → Conservatória: 243.1 km
 *   Nova Friburgo → Teresópolis:    56.1 km (de endereço com rua/número)
 */

const NET_TIMEOUT = 30_000

describe('normalizeAddress', () => {
  it('corrige espaço antes da vírgula (erro real do cliente)', () => {
    expect(normalizeAddress('Nova Friburgo , RJ')).toBe('Nova Friburgo, RJ')
  })

  it('colapsa espaços repetidos e vírgulas duplicadas', () => {
    expect(normalizeAddress('Rua  X ,, Niterói ,  RJ')).toBe('Rua X, Niterói, RJ')
  })

  it('remove vírgulas e espaços nas pontas', () => {
    expect(normalizeAddress('  , Petrópolis, RJ ,  ')).toBe('Petrópolis, RJ')
  })

  it('não quebra com entrada vazia', () => {
    expect(normalizeAddress('')).toBe('')
    expect(normalizeAddress('   ')).toBe('')
  })
})

describe('getRouteDistance sem OPENROUTE_API_KEY', () => {
  beforeEach(() => {
    delete process.env.OPENROUTE_API_KEY
  })

  it(
    'resolve a rota do caso relatado com distância real, não aproximação',
    async () => {
      const r = await getRouteDistance('Nova Friburgo , RJ', 'Conservatoria, RJ')

      // Tem de ser rota real por estrada, sem depender de chave nenhuma.
      expect(r.method).toBe('route')
      expect(r.approximate).toBe(false)
      expect(r.provider).toBe('OSRM')

      // ~243 km. O bug antigo devolvia 199.2 km aqui.
      expect(r.distanceKm).toBeGreaterThan(230)
      expect(r.distanceKm).toBeLessThan(260)
      expect(r.distanceKm).not.toBeCloseTo(199.2, 0)

      expect(r.durationMin).toBeGreaterThan(180)
    },
    NET_TIMEOUT,
  )

  it(
    'aceita endereço com rua e número',
    async () => {
      const r = await getRouteDistance(
        'Rua Alberto Braune, 100, Nova Friburgo, RJ',
        'Teresopolis, RJ',
      )
      expect(r.method).toBe('route')
      expect(r.distanceKm).toBeGreaterThan(40)
      expect(r.distanceKm).toBeLessThan(80)
    },
    NET_TIMEOUT,
  )

  it(
    'rejeita endereço inexistente em vez de inventar distância',
    async () => {
      await expect(
        getRouteDistance('Nova Friburgo, RJ', 'Xyzqwe Nao Existe 99999, RJ'),
      ).rejects.toThrow(/Destino/)
    },
    NET_TIMEOUT,
  )

  it(
    'origem e destino iguais resultam em distância ~zero, não em erro',
    async () => {
      const alerta = vi.spyOn(console, 'error').mockImplementation(() => {})

      const r = await getRouteDistance('Nova Friburgo, RJ', 'Nova Friburgo, RJ')
      expect(r.distanceKm).toBeLessThan(5)

      // 0 km é a resposta correta aqui: tem de vir do roteador, sem cair no
      // fallback nem disparar alerta falso.
      expect(r.method).toBe('route')
      expect(r.approximate).toBe(false)
      expect(alerta).not.toHaveBeenCalled()

      alerta.mockRestore()
    },
    NET_TIMEOUT,
  )
})

describe('fallback quando nenhum roteador responde', () => {
  const realFetch = globalThis.fetch

  beforeEach(() => {
    delete process.env.OPENROUTE_API_KEY
    // Deixa o geocoding passar, derruba só os roteadores.
    globalThis.fetch = (async (url: any, init: any) => {
      const u = String(url)
      if (u.includes('router.project-osrm.org') || u.includes('/v2/directions/')) {
        throw new Error('simulado: roteador indisponível')
      }
      return realFetch(url, init)
    }) as any
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it(
    'aproxima com erro pequeno e marca o resultado como aproximado',
    async () => {
      const warn = vi.spyOn(console, 'error').mockImplementation(() => {})

      const r = await getRouteDistance('Nova Friburgo, RJ', 'Conservatoria, RJ')

      expect(r.method).toBe('estimate')
      expect(r.approximate).toBe(true)
      expect(r.provider).toContain('haversine')

      // Com fator 1.63 a aproximação fica ~240 km contra 243.1 reais (~1%).
      // Com o fator antigo (1.35) dava 199.2 km — fora desta faixa.
      expect(r.distanceKm).toBeGreaterThan(225)
      expect(r.distanceKm).toBeLessThan(255)

      // Tem de gritar no log, para a degradação não passar em silêncio.
      expect(warn).toHaveBeenCalled()
      expect(String(warn.mock.calls[0][0])).toContain('ALERTA')

      warn.mockRestore()
    },
    NET_TIMEOUT,
  )
})
