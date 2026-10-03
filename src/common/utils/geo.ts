import { env } from '../config/env'

const ORS_BASE = 'https://api.openrouteservice.org'
const OSRM_BASE = 'https://router.project-osrm.org'
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const PHOTON_BASE = 'https://photon.komoot.io'

// User-Agent obrigatório pelo Nominatim ToS
const NOMINATIM_HEADERS = {
  'User-Agent': 'viagem-motorista/1.0 (stefani292005@gmail.com)',
  'Accept-Language': 'pt-BR,pt',
}

/** Timeout de cada chamada externa. Rota é mais custosa que geocoding. */
const GEOCODE_TIMEOUT_MS = 6_000
const ROUTE_TIMEOUT_MS = 10_000

/**
 * Fator de tortuosidade calibrado para a Serra Carioca / RJ.
 *
 * Medido contra rotas reais (OSRM) a partir de Nova Friburgo:
 *   Conservatória 1.65 · Petrópolis 1.79 · Teresópolis 1.65
 *   Cabo Frio 1.66 · Macaé 1.56 · Rio de Janeiro 1.47
 *   → média 1.63
 *
 * O valor anterior (1.35) subestimava sistematicamente: na rota
 * Nova Friburgo → Conservatória devolvia 199.2 km contra 243.1 km reais (−18%).
 *
 * Estrada de montanha serpenteia muito mais que a média nacional.
 */
const SERRA_DETOUR_FACTOR = 1.63

/**
 * Velocidade média real medida nas mesmas rotas: 46–59 km/h (média ~52).
 * O valor anterior (70 km/h) subestimava a duração em ~25%.
 */
const SERRA_AVG_SPEED_KMH = 52

interface Coordinates {
  lat: number
  lng: number
}

export type DistanceMethod = 'route' | 'estimate'

export interface RouteResult {
  distanceKm: number
  durationMin: number
  method: DistanceMethod
  /** Provedor que resolveu a rota — para diagnóstico e logs. */
  provider: string
  /**
   * true quando a distância vem de aproximação (linha reta × fator), não de
   * rota real por estrada. A camada de apresentação DEVE sinalizar isso ao
   * usuário em vez de apresentar o número como se fosse exato.
   */
  approximate: boolean
}

/** Limites do território brasileiro, usados para sanidade do geocoding. */
const BR_BOUNDS = { minLat: -33.75, maxLat: 5.27, minLng: -73.99, maxLng: -34.79 }

function isInsideBrazil(c: Coordinates): boolean {
  return (
    c.lat >= BR_BOUNDS.minLat && c.lat <= BR_BOUNDS.maxLat &&
    c.lng >= BR_BOUNDS.minLng && c.lng <= BR_BOUNDS.maxLng
  )
}

/** fetch com timeout — evita que uma API pendurada trave o orçamento inteiro. */
async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = GEOCODE_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Normaliza endereços digitados à mão antes de geocodificar.
 * Corrige os erros que mais aparecem na prática: espaço antes da vírgula,
 * vírgulas duplicadas, espaços repetidos e falta do sufixo de país.
 */
export function normalizeAddress(raw: string): string {
  let s = (raw ?? '').trim()
  s = s.replace(/\s+/g, ' ')
  s = s.replace(/\s+,/g, ',')
  s = s.replace(/,\s*,+/g, ',')
  s = s.replace(/^[,\s]+|[,\s]+$/g, '')
  return s
}

/** Variações progressivamente mais amplas para tentar no geocoder. */
function addressVariants(address: string): string[] {
  const base = normalizeAddress(address)
  const variants = [base]

  // Acrescenta o país: desambigua topônimos repetidos em outros países.
  if (!/brasil|brazil/i.test(base)) variants.push(`${base}, Brasil`)

  // Último recurso: só cidade + UF, descartando número/rua que o geocoder
  // pode não conhecer. Mantém a precisão em nível de município.
  const parts = base.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length > 2) {
    const tail = parts.slice(-2).join(', ')
    variants.push(`${tail}, Brasil`)
  }

  return [...new Set(variants)]
}

/** Geocodifica via Nominatim (OpenStreetMap) restrito ao Brasil. */
async function geocodeNominatim(address: string): Promise<Coordinates> {
  const params = new URLSearchParams({
    q: address,
    format: 'json',
    limit: '1',
    countrycodes: 'br',
    addressdetails: '0',
  })
  const res = await fetchWithTimeout(`${NOMINATIM_BASE}/search?${params}`, {
    headers: NOMINATIM_HEADERS,
  })
  if (!res.ok) throw new Error(`Nominatim falhou: ${res.status}`)
  const json = (await res.json()) as any[]
  if (!json.length) throw new Error(`Nominatim: endereço não encontrado: "${address}"`)
  return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) }
}

/** Geocodifica via Photon (Komoot) — sem chave, bom com erros de digitação. */
async function geocodePhoton(address: string): Promise<Coordinates> {
  const params = new URLSearchParams({ q: address, limit: '1', lang: 'pt' })
  const res = await fetchWithTimeout(`${PHOTON_BASE}/api?${params}`)
  if (!res.ok) throw new Error(`Photon falhou: ${res.status}`)
  const json = (await res.json()) as any
  const feat = json.features?.[0]
  if (!feat) throw new Error(`Photon: endereço não encontrado: "${address}"`)
  const [lng, lat] = feat.geometry.coordinates as [number, number]
  return { lat, lng }
}

/** Geocodifica via ORS, restrito ao retângulo do Brasil. Exige chave. */
async function geocodeORS(address: string): Promise<Coordinates> {
  if (!env.OPENROUTE_API_KEY) throw new Error('OPENROUTE_API_KEY não configurada')
  const params = new URLSearchParams({
    api_key: env.OPENROUTE_API_KEY,
    text: address,
    size: '1',
    'boundary.rect.min_lon': String(BR_BOUNDS.minLng),
    'boundary.rect.min_lat': String(BR_BOUNDS.minLat),
    'boundary.rect.max_lon': String(BR_BOUNDS.maxLng),
    'boundary.rect.max_lat': String(BR_BOUNDS.maxLat),
  })
  const res = await fetchWithTimeout(`${ORS_BASE}/geocode/search?${params}`)
  if (!res.ok) throw new Error(`ORS geocode falhou: ${res.status}`)
  const json = (await res.json()) as any
  const feature = json.features?.[0]
  if (!feature) throw new Error(`ORS: endereço não encontrado: "${address}"`)
  const [lng, lat] = feature.geometry.coordinates as [number, number]
  return { lat, lng }
}

/** Cache em memória do geocoding — endereços repetem muito entre orçamentos. */
const geocodeCache = new Map<string, Coordinates>()
const GEOCODE_CACHE_MAX = 500

/**
 * Geocodifica tentando, em ordem: Nominatim → Photon → ORS,
 * cada um sobre variações progressivamente mais amplas do endereço.
 * Só aceita coordenada dentro do Brasil.
 */
async function geocode(address: string, label: string): Promise<Coordinates> {
  const variants = addressVariants(address)
  const cacheKey = variants[0].toLowerCase()

  const cached = geocodeCache.get(cacheKey)
  if (cached) return cached

  const providers: Array<[string, (a: string) => Promise<Coordinates>]> = [
    ['Nominatim', geocodeNominatim],
    ['Photon', geocodePhoton],
  ]
  if (env.OPENROUTE_API_KEY) providers.push(['ORS', geocodeORS])

  const failures: string[] = []

  for (const variant of variants) {
    for (const [name, fn] of providers) {
      try {
        const coord = await fn(variant)
        if (!isInsideBrazil(coord)) {
          failures.push(`${name}("${variant}") resolveu fora do Brasil`)
          continue
        }
        if (geocodeCache.size >= GEOCODE_CACHE_MAX) {
          geocodeCache.delete(geocodeCache.keys().next().value as string)
        }
        geocodeCache.set(cacheKey, coord)
        return coord
      } catch (err) {
        failures.push(`${name}("${variant}"): ${(err as Error).message}`)
      }
    }
  }

  throw new Error(
    `${label}: não foi possível localizar o endereço "${address}". Tentativas: ${failures.join(' | ')}`,
  )
}

/** Distância em linha reta entre dois pontos (Haversine). */
function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Rota real por estrada via ORS Directions. Exige chave. */
async function orsDirections(
  origin: Coordinates,
  destination: Coordinates,
): Promise<{ distanceKm: number; durationMin: number }> {
  if (!env.OPENROUTE_API_KEY) throw new Error('OPENROUTE_API_KEY não configurada')

  const res = await fetchWithTimeout(
    `${ORS_BASE}/v2/directions/driving-car`,
    {
      method: 'POST',
      headers: {
        Authorization: env.OPENROUTE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
      }),
    },
    ROUTE_TIMEOUT_MS,
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ORS directions falhou: ${res.status} — ${body.slice(0, 200)}`)
  }
  const json = (await res.json()) as any
  const summary = json.routes?.[0]?.summary
  if (!summary) throw new Error('ORS: nenhuma rota retornada')

  return {
    distanceKm: round1(summary.distance / 1000),
    durationMin: Math.round(summary.duration / 60),
  }
}

/**
 * Rota real por estrada via OSRM público. Não exige chave — por isso é o
 * provedor primário: funciona mesmo sem nenhuma variável de ambiente.
 */
async function osrmDirections(
  origin: Coordinates,
  destination: Coordinates,
): Promise<{ distanceKm: number; durationMin: number }> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
  const res = await fetchWithTimeout(
    `${OSRM_BASE}/route/v1/driving/${coords}?overview=false&alternatives=false`,
    {},
    ROUTE_TIMEOUT_MS,
  )
  if (!res.ok) throw new Error(`OSRM falhou: ${res.status}`)
  const json = (await res.json()) as any
  if (json.code !== 'Ok' || !json.routes?.length) {
    throw new Error(`OSRM: nenhuma rota retornada (code=${json.code})`)
  }
  const route = json.routes[0]
  return {
    distanceKm: round1(route.distance / 1000),
    durationMin: Math.round(route.duration / 60),
  }
}

/**
 * Sanidade da rota: uma rota por estrada nunca é menor que a linha reta,
 * e um desvio absurdo indica que o roteador pegou o ponto errado.
 * Rejeitar é melhor que cobrar o passageiro por uma distância inventada.
 */
function routeIsPlausible(distanceKm: number, straightKm: number): boolean {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return false
  // Origem e destino no mesmo ponto: 0 km é a resposta correta, não um erro.
  if (distanceKm === 0) return straightKm < 1
  // margem de 2% para erro de arredondamento em distâncias muito curtas
  if (distanceKm < straightKm * 0.98) return false
  if (distanceKm > straightKm * 3.5 + 20) return false
  return true
}

/**
 * Distância e duração entre dois endereços brasileiros.
 *
 * Estratégia em camadas, tolerante a falha de qualquer provedor:
 *   1. Geocoding: Nominatim → Photon → ORS, sobre variações do endereço
 *   2. Rota real:  OSRM → ORS Directions  (validada contra a linha reta)
 *   3. Aproximação: Haversine × 1.63, marcada como `approximate: true`
 *
 * O resultado sempre informa se é rota real ou aproximação, para que a
 * interface não apresente um número aproximado como se fosse exato.
 */
export async function getRouteDistance(
  originAddress: string,
  destinationAddress: string,
): Promise<RouteResult> {
  const [origin, destination] = await Promise.all([
    geocode(originAddress, 'Origem'),
    geocode(destinationAddress, 'Destino'),
  ])

  const straight = haversineKm(origin, destination)

  const routeProviders: Array<[string, typeof osrmDirections]> = [['OSRM', osrmDirections]]
  if (env.OPENROUTE_API_KEY) routeProviders.push(['ORS', orsDirections])

  for (const [name, fn] of routeProviders) {
    try {
      const route = await fn(origin, destination)
      if (!routeIsPlausible(route.distanceKm, straight)) {
        console.warn(
          `[geo] ${name} devolveu rota implausível: ${route.distanceKm} km para ${round1(straight)} km em linha reta — descartando`,
        )
        continue
      }
      return { ...route, method: 'route', provider: name, approximate: false }
    } catch (err) {
      console.warn(`[geo] ${name} falhou: ${(err as Error).message}`)
    }
  }

  // Nenhum roteador respondeu: aproxima e deixa explícito que é aproximação.
  const distanceKm = round1(straight * SERRA_DETOUR_FACTOR)
  const durationMin = Math.round((distanceKm / SERRA_AVG_SPEED_KMH) * 60)

  console.error(
    `[geo] ALERTA: nenhum roteador disponível para "${originAddress}" → "${destinationAddress}". ` +
      `Usando aproximação Haversine×${SERRA_DETOUR_FACTOR} = ${distanceKm} km. ` +
      `Verifique conectividade e OPENROUTE_API_KEY.`,
  )

  return {
    distanceKm,
    durationMin,
    method: 'estimate',
    provider: `haversine×${SERRA_DETOUR_FACTOR}`,
    approximate: true,
  }
}
