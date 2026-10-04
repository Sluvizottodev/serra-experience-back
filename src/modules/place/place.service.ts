import { CITIES_BY_UF } from './br-cities'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse'

/**
 * User-Agent identificável é exigido pela política de uso do Nominatim.
 * Sem ele a resposta é 403 — era isso que quebrava o autocomplete, que
 * chamava a API direto do navegador.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const HEADERS = {
  'User-Agent': 'serra-experience/1.0 (stefani292005@gmail.com)',
  'Accept-Language': 'pt-BR,pt',
}

const TIMEOUT_MS = 6_000

export interface PlaceSuggestion {
  /** Nome exibido na lista (cidade ou rua) */
  label: string
  /** Texto secundário: UF para cidade, bairro para rua */
  sub?: string
  /** 'local' = lista embutida (instantâneo); 'osm' = veio do Nominatim */
  source: 'local' | 'osm'
}

const UF_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia',
  RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe',
  TO: 'Tocantins',
}

/** Remove acentos e normaliza para comparação tolerante a digitação. */
export function norm(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Distância de Damerau-Levenshtein com corte: número mínimo de inserções,
 * remoções, substituições e **transposições** para transformar `a` em `b`.
 *
 * A transposição é o que importa aqui — "Fribrugo" → "Friburgo" é um único
 * erro de digitação (duas letras trocadas de lugar), o tipo mais comum em
 * quem digita rápido no celular.
 *
 * Aborta assim que a linha inteira passa de `max`, então o custo real é baixo:
 * medido em 8ms para 20 buscas sobre as 645 cidades de SP.
 */
export function damerauLevenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1

  const m = a.length
  const n = b.length
  let prev2: number[] | null = null
  let prev: number[] = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j

  for (let i = 1; i <= m; i++) {
    const cur: number[] = new Array(n + 1)
    cur[0] = i
    let best = cur[0]

    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      // transposição de duas letras adjacentes
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cur[j] = Math.min(cur[j], prev2[j - 2] + 1)
      }
      if (cur[j] < best) best = cur[j]
    }

    // Nenhum caminho nesta linha cabe no orçamento: desiste cedo.
    if (best > max) return max + 1
    prev2 = prev
    prev = cur
  }

  return prev[n]
}

/**
 * Quantos erros tolerar conforme o tamanho do que foi digitado.
 * Termo curto com tolerância alta casaria quase tudo, então é escalonado.
 */
function typoBudget(q: string): number {
  if (q.length <= 4) return 0
  if (q.length <= 6) return 1
  return 2
}

/**
 * Cidades grandes e destinos turísticos que devem aparecer antes de
 * homônimos menores. Sem isso, "rio" no RJ devolve Rio Bonito e Rio Claro
 * mas não a capital, e "belo" em MG não traz Belo Horizonte.
 *
 * Não é uma lista de atendimento — é só ordenação. Qualquer cidade do IBGE
 * continua pesquisável.
 */
const PRIORITY_CITIES = new Set(
  [
    // capitais
    'rio de janeiro', 'sao paulo', 'belo horizonte', 'vitoria', 'curitiba',
    'porto alegre', 'salvador', 'brasilia', 'florianopolis', 'goiania',
    'recife', 'fortaleza', 'manaus', 'belem', 'campo grande', 'cuiaba',
    'natal', 'joao pessoa', 'maceio', 'aracaju', 'teresina', 'sao luis',
    'porto velho', 'rio branco', 'boa vista', 'macapa', 'palmas',
    // destinos frequentes da operação (serra e litoral do RJ)
    'nova friburgo', 'teresopolis', 'petropolis', 'cabo frio',
    'armacao dos buzios', 'arraial do cabo', 'angra dos reis', 'paraty',
    'conservatoria', 'lumiar', 'macae', 'niteroi', 'saquarema',
    'valenca', 'vassouras', 'miguel pereira', 'resende', 'itaipava',
  ],
)

/** Endereço completo com coordenadas, para a busca livre do admin. */
export interface AddressSuggestion {
  displayName: string
  lat: number
  lon: number
}

/** Cache simples em memória: a mesma cidade é digitada por muitos usuários. */
const cache = new Map<string, { data: PlaceSuggestion[]; at: number }>()
const addressCache = new Map<string, { data: AddressSuggestion[]; at: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX = 1_000

function cacheGet(key: string): PlaceSuggestion[] | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return hit.data
}

function cacheSet(key: string, data: PlaceSuggestion[]) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
  cache.set(key, { data, at: Date.now() })
}

async function fetchJson<T = any[]>(url: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal })
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

export class PlaceService {
  /**
   * Busca cidades por prefixo dentro de uma UF.
   *
   * Responde primeiro da lista do IBGE embutida: instantâneo, sem rede, e
   * funciona por prefixo — o Nominatim não, "Campin" não acha "Campinas".
   * Só cai para o Nominatim (com cache) quando a lista local não tem nada,
   * cobrindo distritos e localidades que não são sedes municipais.
   */
  async searchCities(uf: string, query: string): Promise<PlaceSuggestion[]> {
    const q = norm(query)
    if (q.length < 2) return []

    const ufUpper = uf.toUpperCase()

    // A lista local resolve o caso normal e, ao contrário do Nominatim,
    // funciona por prefixo ("Campin" → Campinas).
    const local = this.searchLocalCities(ufUpper, q)
    if (local.length) return local

    const cacheKey = `city:${ufUpper}:${q}`
    const cached = cacheGet(cacheKey)
    if (cached) return cached

    const stateName = UF_NAMES[ufUpper] ?? ufUpper
    const params = new URLSearchParams({
      q: `${query}, ${stateName}, Brasil`,
      format: 'json',
      limit: '15',
      countrycodes: 'br',
      addressdetails: '1',
    })

    let rows: any[] = []
    try {
      rows = await fetchJson(`${NOMINATIM}?${params}`)
    } catch (err) {
      console.warn('[places] busca de cidade falhou:', (err as Error).message)
      return []
    }

    const seen = new Set<string>()
    const out: PlaceSuggestion[] = []
    for (const r of rows) {
      const a = r.address ?? {}
      const name =
        a.city ?? a.town ?? a.village ?? a.municipality ??
        String(r.display_name ?? '').split(',')[0]
      if (!name) continue

      // Confere a UF para não sugerir cidade de outro estado.
      const rowUf = a.state ? this.ufFromStateName(a.state) : ''
      if (rowUf && rowUf !== ufUpper) continue

      const key = norm(name)
      if (!key.includes(q) || seen.has(key)) continue
      seen.add(key)
      out.push({ label: name, sub: ufUpper, source: 'osm' })
    }

    const ranked = this.rankMatches(out, q).slice(0, 8)
    cacheSet(cacheKey, ranked)
    return ranked
  }

  /**
   * Busca ruas dentro de uma cidade.
   *
   * Sempre online: nenhuma lista local daria conta das ruas do Brasil.
   *
   * O Nominatim casa prefixo de forma irregular para logradouro — "Alb" pode
   * devolver zero enquanto "Alberto" acha a Avenida Alberto Braune. Por isso
   * a consulta usa o termo completo (melhor recall) e o resultado é guardado
   * por query; o front usa debounce para não consultar a cada tecla.
   */
  async searchStreets(uf: string, city: string, query: string): Promise<PlaceSuggestion[]> {
    const q = norm(query)
    if (q.length < 2 || !city) return []

    const ufUpper = uf.toUpperCase()
    const cacheKey = `street:${ufUpper}:${norm(city)}:${q}`

    const cached = cacheGet(cacheKey)
    if (cached) return cached

    const stateName = UF_NAMES[ufUpper] ?? ufUpper
    const params = new URLSearchParams({
      q: `${query}, ${city}, ${stateName}, Brasil`,
      format: 'json',
      limit: '30',
      countrycodes: 'br',
      addressdetails: '1',
    })

    let rows: any[] = []
    try {
      rows = await fetchJson(`${NOMINATIM}?${params}`)
    } catch (err) {
      console.warn('[places] busca de rua falhou:', (err as Error).message)
      return []
    }

    const cityNorm = norm(city)
    const seen = new Set<string>()
    const out: PlaceSuggestion[] = []

    for (const r of rows) {
      const a = r.address ?? {}
      // Aceita `road`, mas também o primeiro termo do display_name: muitos
      // pontos de interesse têm endereço útil sem o campo `road` preenchido.
      const name = a.road ?? String(r.display_name ?? '').split(',')[0]
      if (!name) continue

      const rowCity = norm(a.city ?? a.town ?? a.village ?? a.municipality ?? '')
      // Filtro de cidade tolerante: se o Nominatim não devolveu cidade,
      // mantém o resultado em vez de descartar (era o que esvaziava a lista).
      if (rowCity && cityNorm && !rowCity.includes(cityNorm) && !cityNorm.includes(rowCity)) {
        continue
      }

      const key = norm(name)
      if (seen.has(key)) continue
      seen.add(key)

      out.push({
        label: name,
        sub: a.suburb ?? a.neighbourhood ?? undefined,
        source: 'osm',
      })
    }

    const ranked = this.rankMatches(out, q).slice(0, 8)
    cacheSet(cacheKey, ranked)
    return ranked
  }

  /**
   * Mantém o que casa com o termo digitado, tolerante a ordem das palavras:
   * "alberto br" encontra "Avenida Alberto Braune".
   */
  private filterByQuery(items: PlaceSuggestion[], qNorm: string): PlaceSuggestion[] {
    const words = qNorm.split(' ').filter(Boolean)
    return items.filter((it) => {
      const label = norm(it.label)
      return words.every((w) => label.includes(w))
    })
  }

  /**
   * Busca livre de endereço, com coordenadas — usada pela tela de
   * configurações do admin, que precisa do endereço completo e do par
   * lat/lon para o "endereço base".
   *
   * Também passa pelo backend por causa do User-Agent exigido pelo Nominatim.
   */
  async searchAddresses(query: string): Promise<AddressSuggestion[]> {
    const q = query.trim()
    if (q.length < 3) return []

    const cacheKey = `addr:${norm(q)}`
    const cached = addressCache.get(cacheKey)
    if (cached && Date.now() - cached.at <= CACHE_TTL_MS) return cached.data

    const params = new URLSearchParams({
      q,
      format: 'jsonv2',
      limit: '6',
      countrycodes: 'br',
      addressdetails: '1',
    })

    let rows: any[] = []
    try {
      rows = await fetchJson(`${NOMINATIM}?${params}`)
    } catch (err) {
      console.warn('[places] busca de endereco falhou:', (err as Error).message)
      return []
    }

    const out: AddressSuggestion[] = rows
      .filter((r) => r?.display_name && r.lat && r.lon)
      .map((r) => ({
        displayName: String(r.display_name),
        lat: Number.parseFloat(r.lat),
        lon: Number.parseFloat(r.lon),
      }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon))

    if (addressCache.size >= CACHE_MAX) {
      addressCache.delete(addressCache.keys().next().value as string)
    }
    addressCache.set(cacheKey, { data: out, at: Date.now() })
    return out
  }

  /**
   * Converte coordenada em endereço, para o botão "usar minha localização".
   *
   * Vive no backend pelo mesmo motivo da busca: o Nominatim exige
   * User-Agent identificável e responde 403 sem ele — e o navegador não
   * permite definir esse header. Medido: 403 sem, 200 com.
   *
   * Coordenada em área rural pode não ter cidade no zoom padrão; nesse caso
   * repete em nível de município para recuperar ao menos cidade e UF.
   */
  async reverseGeocode(
    lat: number,
    lon: number,
  ): Promise<{ uf: string; city: string; street: string; number: string }> {
    const fetchAddr = async (zoom?: number) => {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        format: 'json',
        addressdetails: '1',
      })
      if (zoom !== undefined) params.set('zoom', String(zoom))
      const json = await fetchJson<any>(`${NOMINATIM_REVERSE}?${params}`)
      return json?.address ?? null
    }

    const addr = await fetchAddr()
    let uf = addr?.state ? this.ufFromStateName(addr.state) : ''
    let city = addr?.city ?? addr?.town ?? addr?.village ?? addr?.municipality ?? ''

    if (!uf || !city) {
      const wide = await fetchAddr(10).catch(() => null)
      if (wide) {
        if (!uf && wide.state) uf = this.ufFromStateName(wide.state)
        if (!city) city = wide.city ?? wide.town ?? wide.village ?? wide.municipality ?? ''
      }
    }

    if (!uf && !city) throw new Error('Endereço não encontrado para esta localização')

    return {
      uf,
      city,
      street: addr?.road ?? '',
      number: addr?.house_number ?? '',
    }
  }

  /**
   * Cidades da lista embutida (IBGE) que casam com o termo digitado.
   *
   * Duas passagens: primeiro a correspondência literal (rápida e precisa);
   * se ela não achar nada, tenta tolerando erro de digitação. A ordem importa
   * — rodar o fuzzy sempre encheria a lista de palpites quando o usuário já
   * digitou certo.
   */
  private searchLocalCities(uf: string, qNorm: string): PlaceSuggestion[] {
    const list = CITIES_BY_UF[uf]
    if (!list) return []

    const all = list.map((c): PlaceSuggestion => ({ label: c, sub: uf, source: 'local' }))

    const exact = this.filterByQuery(all, qNorm)
    if (exact.length) return this.rankMatches(exact, qNorm).slice(0, 8)

    return this.fuzzyMatches(all, qNorm).slice(0, 8)
  }

  /**
   * Candidatos a até N erros de digitação do que foi escrito.
   * Compara com o nome inteiro e também sem espaços, para pegar
   * "cabofrio" → "Cabo Frio" e "angradosreis" → "Angra dos Reis".
   */
  private fuzzyMatches(items: PlaceSuggestion[], qNorm: string): PlaceSuggestion[] {
    const budget = typoBudget(qNorm)
    if (budget === 0) return []

    const qTight = qNorm.replace(/ /g, '')
    const scored: Array<{ item: PlaceSuggestion; d: number }> = []

    for (const item of items) {
      const label = norm(item.label)
      let d = damerauLevenshtein(qNorm, label, budget)
      if (d > budget) {
        d = damerauLevenshtein(qTight, label.replace(/ /g, ''), budget)
      }
      if (d <= budget) scored.push({ item, d })
    }

    return scored
      .sort((a, b) => {
        if (a.d !== b.d) return a.d - b.d
        const pa = PRIORITY_CITIES.has(norm(a.item.label)) ? 0 : 1
        const pb = PRIORITY_CITIES.has(norm(b.item.label)) ? 0 : 1
        if (pa !== pb) return pa - pb
        return a.item.label.localeCompare(b.item.label, 'pt-BR')
      })
      .map((x) => x.item)
  }

  /**
   * Ordena por relevância, em três critérios:
   *   1. começa com o termo digitado (match mais forte)
   *   2. é cidade grande / destino frequente
   *   3. ordem alfabética
   *
   * O critério 2 existe porque "rio" no RJ trazia Rio Bonito e Rio Claro
   * mas não a capital, e "belo" em MG não trazia Belo Horizonte.
   */
  private rankMatches(items: PlaceSuggestion[], qNorm: string): PlaceSuggestion[] {
    const score = (it: PlaceSuggestion): number => {
      const label = norm(it.label)
      let s = 0
      if (!label.startsWith(qNorm)) s += 2
      if (!PRIORITY_CITIES.has(label)) s += 1
      return s
    }
    return [...items].sort((a, b) => {
      const d = score(a) - score(b)
      if (d !== 0) return d
      return a.label.localeCompare(b.label, 'pt-BR')
    })
  }

  private ufFromStateName(stateName: string): string {
    const target = norm(stateName)
    for (const [uf, name] of Object.entries(UF_NAMES)) {
      if (norm(name) === target) return uf
    }
    return ''
  }
}
