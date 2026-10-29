import { describe, it, expect } from 'vitest'
import { PlaceService, norm, damerauLevenshtein } from './place.service'
import { CITIES_BY_UF } from './br-cities'

const svc = new PlaceService()

describe('norm', () => {
  it('remove acentos para busca tolerante', () => {
    expect(norm('Teresópolis')).toBe('teresopolis')
    expect(norm('São João')).toBe('sao joao')
  })

  it('não quebra com entrada vazia', () => {
    expect(norm('')).toBe('')
    expect(norm(undefined as any)).toBe('')
  })
})

describe('lista de cidades do IBGE', () => {
  it('cobre as 27 UFs', () => {
    expect(Object.keys(CITIES_BY_UF)).toHaveLength(27)
  })

  it('inclui Conservatória, que não é município mas é destino real', () => {
    expect(CITIES_BY_UF.RJ).toContain('Conservatória')
    expect(CITIES_BY_UF.RJ).toContain('Lumiar')
  })
})

describe('searchCities', () => {
  it('casa prefixo parcial — o que o Nominatim não faz', async () => {
    // "Campin" devolve zero no Nominatim; na lista local acha Campinas.
    const r = await svc.searchCities('SP', 'Campin')
    expect(r.length).toBeGreaterThan(0)
    expect(r.map((x) => x.label)).toContain('Campinas')
    expect(r[0].source).toBe('local')
  })

  it('ignora acentos', async () => {
    const r = await svc.searchCities('RJ', 'teresopolis')
    expect(r.map((x) => x.label)).toContain('Teresópolis')
  })

  it('aceita palavras fora de ordem', async () => {
    const r = await svc.searchCities('SP', 'sao joao b')
    expect(r.map((x) => x.label)).toContain('São João da Boa Vista')
  })

  it('encontra Conservatória, o destino do caso relatado', async () => {
    const r = await svc.searchCities('RJ', 'conserv')
    expect(r.map((x) => x.label)).toContain('Conservatória')
  })

  it('prioriza quem começa com o termo digitado', async () => {
    const r = await svc.searchCities('RJ', 'nova')
    expect(r[0].label.toLowerCase().startsWith('nova')).toBe(true)
  })

  it('não vaza cidade de outra UF', async () => {
    const r = await svc.searchCities('RJ', 'campinas')
    expect(r.every((x) => x.sub === 'RJ')).toBe(true)
  })

  it('exige ao menos 2 caracteres', async () => {
    expect(await svc.searchCities('RJ', 'n')).toEqual([])
    expect(await svc.searchCities('RJ', '')).toEqual([])
  })

  it('UF desconhecida devolve lista vazia sem lançar', async () => {
    const r = await svc.searchCities('ZZ', 'teste')
    expect(Array.isArray(r)).toBe(true)
  })

  it('responde instantaneamente para a lista local', async () => {
    const t0 = Date.now()
    await svc.searchCities('RJ', 'nova f')
    // Sem rede: deve ser trivial. Margem larga para CI lento.
    expect(Date.now() - t0).toBeLessThan(500)
  })
})

describe('damerauLevenshtein', () => {
  it('conta transposição de letras adjacentes como 1 erro', () => {
    // "Fribrugo" vs "Friburgo": u e r trocados de lugar
    expect(damerauLevenshtein('fribrugo', 'friburgo', 2)).toBe(1)
  })

  it('conta substituição como 1 erro', () => {
    expect(damerauLevenshtein('terezopolis', 'teresopolis', 2)).toBe(1)
  })

  it('é 0 para strings iguais', () => {
    expect(damerauLevenshtein('niteroi', 'niteroi', 2)).toBe(0)
  })

  it('corta cedo quando passa do orçamento', () => {
    expect(damerauLevenshtein('abc', 'xyzxyzxyz', 2)).toBeGreaterThan(2)
  })
})

describe('tolerância a erro de digitação', () => {
  const casos: Array<[string, string, string]> = [
    ['RJ', 'terezopolis', 'Teresópolis'],
    ['RJ', 'Petropilis', 'Petrópolis'],
    ['RJ', 'Nova Fribrugo', 'Nova Friburgo'],
    ['RJ', 'parati', 'Paraty'],
    ['RJ', 'cabofrio', 'Cabo Frio'],
    ['RJ', 'saquarena', 'Saquarema'],
    ['RJ', 'angradosreis', 'Angra dos Reis'],
    ['SP', 'sao jose do rio pret', 'São José do Rio Preto'],
  ]

  it.each(casos)('%s "%s" encontra %s', async (uf, q, esperado) => {
    const r = await svc.searchCities(uf, q)
    expect(r.map((x) => x.label)).toContain(esperado)
  })

  it('não aplica fuzzy quando a busca exata já acha algo', async () => {
    // "nova" casa literalmente; não deve trazer palpites distantes.
    const r = await svc.searchCities('RJ', 'nova')
    expect(r.every((x) => norm(x.label).includes('nova'))).toBe(true)
  })

  it('termo muito curto não aciona fuzzy (evitaria casar tudo)', async () => {
    const r = await svc.searchCities('RJ', 'xqz')
    expect(r).toEqual([])
  })
})

describe('relevância', () => {
  it('traz a capital antes de homônimos menores', async () => {
    const r = await svc.searchCities('RJ', 'rio')
    expect(r[0].label).toBe('Rio de Janeiro')
  })

  it('Belo Horizonte vem antes de Belo Oriente/Vale', async () => {
    const r = await svc.searchCities('MG', 'belo')
    expect(r[0].label).toBe('Belo Horizonte')
  })

  it('destino frequente da operação é priorizado', async () => {
    const r = await svc.searchCities('RJ', 'cabo')
    expect(r[0].label).toBe('Cabo Frio')
  })

  it('prefixo ainda vence prioridade', async () => {
    // Arraial do Cabo é prioritário, mas não começa com "cabo".
    const r = await svc.searchCities('RJ', 'cabo')
    expect(r[0].label.toLowerCase().startsWith('cabo')).toBe(true)
  })
})

describe('reverseGeocode (botão "usar localização")', () => {
  it(
    'converte coordenada do centro de Nova Friburgo em endereço',
    async () => {
      const r = await svc.reverseGeocode(-22.2819, -42.5311)
      expect(r.uf).toBe('RJ')
      expect(r.city).toBe('Nova Friburgo')
      expect(typeof r.street).toBe('string')
    },
    30_000,
  )

  it(
    'coordenada no oceano não resolve para endereço brasileiro',
    async () => {
      // (0,0) fica no Golfo da Guiné.
      await expect(svc.reverseGeocode(0, 0)).rejects.toThrow()
    },
    30_000,
  )
})

describe('searchAddresses (busca livre do admin)', () => {
  it(
    'devolve endereço com coordenadas finitas',
    async () => {
      const r = await svc.searchAddresses('Rua Alberto Braune, Nova Friburgo')
      expect(r.length).toBeGreaterThan(0)
      for (const item of r) {
        expect(typeof item.displayName).toBe('string')
        expect(Number.isFinite(item.lat)).toBe(true)
        expect(Number.isFinite(item.lon)).toBe(true)
      }
    },
    30_000,
  )

  it('termo curto não consulta a rede', async () => {
    expect(await svc.searchAddresses('ab')).toEqual([])
    expect(await svc.searchAddresses('')).toEqual([])
  })
})

describe('searchStreets', () => {
  it('encontra rua real e usa cache na repetição', async () => {
    const first = await svc.searchStreets('RJ', 'Nova Friburgo', 'Alberto')
    expect(first.length).toBeGreaterThan(0)
    expect(first.some((x) => /alberto/i.test(x.label))).toBe(true)

    const t0 = Date.now()
    const second = await svc.searchStreets('RJ', 'Nova Friburgo', 'Alberto')
    expect(Date.now() - t0).toBeLessThan(100)
    expect(second).toEqual(first)
  }, 30_000)

  it('sem cidade devolve vazio', async () => {
    expect(await svc.searchStreets('RJ', '', 'Alberto')).toEqual([])
  })

  it('exige ao menos 2 caracteres', async () => {
    expect(await svc.searchStreets('RJ', 'Nova Friburgo', 'a')).toEqual([])
  })
})
