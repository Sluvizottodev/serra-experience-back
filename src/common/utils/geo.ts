import { env } from '../config/env'

const ORS_BASE = 'https://api.openrouteservice.org'
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

// User-Agent obrigatório pelo Nominatim ToS
const NOMINATIM_HEADERS = {
  'User-Agent': 'viagem-motorista/1.0 (stefani292005@gmail.com)',
  'Accept-Language': 'pt-BR,pt',
}

interface Coordinates {
  lat: number
  lng: number
}

/**
 * Geocodifica via Nominatim (OpenStreetMap) restrito ao Brasil.
 * Muito mais preciso para endereços brasileiros que o geocoder do ORS.
 */
async function geocodeNominatim(address: string): Promise<Coordinates> {
  const params = new URLSearchParams({
    q: address,
    format: 'json',
    limit: '1',
    countrycodes: 'br',
    addressdetails: '0',
  })
  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: NOMINATIM_HEADERS,
  })
  if (!res.ok) throw new Error(`Nominatim falhou: ${res.status}`)
  const json = await res.json() as any[]
  if (!json.length) throw new Error(`Endereço não encontrado no Brasil: "${address}"`)
  return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) }
}

/**
 * Geocodifica via ORS como fallback (menos preciso para BR, mas útil se Nominatim falhar).
 * Força busca no Brasil via boundary box aproximado.
 */
async function geocodeORS(address: string): Promise<Coordinates> {
  if (!env.OPENROUTE_API_KEY) throw new Error('OPENROUTE_API_KEY não configurada')
  // boundary.rect cobre o território brasileiro
  const params = new URLSearchParams({
    api_key: env.OPENROUTE_API_KEY,
    text: address,
    size: '1',
    'boundary.rect.min_lon': '-73.99',
    'boundary.rect.min_lat': '-33.75',
    'boundary.rect.max_lon': '-34.79',
    'boundary.rect.max_lat': '5.27',
  })
  const res = await fetch(`${ORS_BASE}/geocode/search?${params}`)
  if (!res.ok) throw new Error(`ORS geocode falhou: ${res.status}`)
  const json = await res.json() as any
  const feature = json.features?.[0]
  if (!feature) throw new Error(`ORS: endereço não encontrado: "${address}"`)
  const [lng, lat] = feature.geometry.coordinates as [number, number]
  return { lat, lng }
}

/** Tenta Nominatim primeiro; se falhar, tenta ORS */
async function geocode(address: string): Promise<Coordinates> {
  try {
    return await geocodeNominatim(address)
  } catch (errNominatim) {
    console.warn('[geo] Nominatim falhou, tentando ORS:', (errNominatim as Error).message)
    return await geocodeORS(address)
  }
}

/** Distância em linha reta entre dois pontos (Haversine) */
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

/**
 * Calcula a distância real por estrada via ORS Directions.
 * Recebe coordenadas já resolvidas.
 */
async function orsDirections(
  origin: Coordinates,
  destination: Coordinates,
): Promise<{ distanceKm: number; durationMin: number }> {
  if (!env.OPENROUTE_API_KEY) throw new Error('OPENROUTE_API_KEY não configurada')

  const res = await fetch(`${ORS_BASE}/v2/directions/driving-car`, {
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
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ORS directions falhou: ${res.status} — ${body}`)
  }
  const json = await res.json() as any
  const summary = json.routes?.[0]?.summary
  if (!summary) throw new Error('ORS: nenhuma rota retornada')

  return {
    distanceKm: Math.round((summary.distance / 1000) * 10) / 10,
    durationMin: Math.round(summary.duration / 60),
  }
}

/**
 * Retorna distância e duração entre dois endereços brasileiros.
 *
 * Estratégia em camadas:
 * 1. Geocoding: Nominatim (BR-restrito) → fallback ORS
 * 2. Rota: ORS Directions (rota real por estrada)
 * 3. Fallback final: Haversine × 1.35 (fator de tortuosidade médio para BR)
 */
export async function getRouteDistance(
  originAddress: string,
  destinationAddress: string,
): Promise<{ distanceKm: number; durationMin: number; method: 'route' | 'estimate' }> {
  const [origin, destination] = await Promise.all([
    geocode(originAddress),
    geocode(destinationAddress),
  ])

  // Sanidade: se as coordenadas estiverem fora do Brasil, aborta
  const brBounds = { minLat: -33.75, maxLat: 5.27, minLng: -73.99, maxLng: -34.79 }
  for (const [label, coord] of [['Origem', origin], ['Destino', destination]] as const) {
    if (
      coord.lat < brBounds.minLat || coord.lat > brBounds.maxLat ||
      coord.lng < brBounds.minLng || coord.lng > brBounds.maxLng
    ) {
      throw new Error(`${label} resolveu fora do Brasil (lat=${coord.lat}, lng=${coord.lng}). Verifique o endereço.`)
    }
  }

  if (env.OPENROUTE_API_KEY) {
    try {
      const route = await orsDirections(origin, destination)
      return { ...route, method: 'route' }
    } catch (err) {
      console.warn('[geo] ORS directions falhou, usando estimativa Haversine:', (err as Error).message)
    }
  }

  // Fallback: Haversine × 1.35 (estradas brasileiras são ~35% mais longas que linha reta)
  const straight = haversineKm(origin, destination)
  const distanceKm = Math.round(straight * 1.35 * 10) / 10
  // Velocidade média estimada: 70 km/h para rodovias BR
  const durationMin = Math.round((distanceKm / 70) * 60)
  return { distanceKm, durationMin, method: 'estimate' }
}
