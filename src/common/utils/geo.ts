import { env } from '../config/env'

const ORS_BASE = 'https://api.openrouteservice.org'

interface Coordinates {
  lat: number
  lng: number
}

/** Geocodifica um endereço em texto para coordenadas via ORS Geocode Search */
async function geocode(address: string): Promise<Coordinates> {
  const url = `${ORS_BASE}/geocode/search?api_key=${env.OPENROUTE_API_KEY}&text=${encodeURIComponent(address)}&size=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Geocode falhou: ${res.status}`)
  const json = await res.json() as any
  const feature = json.features?.[0]
  if (!feature) throw new Error(`Endereço não encontrado: "${address}"`)
  const [lng, lat] = feature.geometry.coordinates as [number, number]
  return { lat, lng }
}

/** Retorna distância em km e duração em minutos entre dois endereços */
export async function getRouteDistance(
  originAddress: string,
  destinationAddress: string,
): Promise<{ distanceKm: number; durationMin: number }> {
  if (!env.OPENROUTE_API_KEY) {
    throw new Error('OPENROUTE_API_KEY não configurada')
  }

  const [origin, destination] = await Promise.all([
    geocode(originAddress),
    geocode(destinationAddress),
  ])

  const url = `${ORS_BASE}/v2/directions/driving-car`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': env.OPENROUTE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coordinates: [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
      ],
    }),
  })

  if (!res.ok) throw new Error(`Rota falhou: ${res.status}`)
  const json = await res.json() as any
  const summary = json.routes?.[0]?.summary
  if (!summary) throw new Error('Sem rota encontrada entre os endereços')

  return {
    distanceKm: Math.round((summary.distance / 1000) * 10) / 10,
    durationMin: Math.round(summary.duration / 60),
  }
}

/** Haversine — fallback quando a API não está configurada */
export function haversineKm(a: Coordinates, b: Coordinates): number {
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
