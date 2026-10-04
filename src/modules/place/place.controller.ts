import type { Request, Response } from 'express'
import { PlaceService } from './place.service'
import { AppError } from '../../common/middlewares/error.middleware'

const svc = new PlaceService()

const UF_RE = /^[A-Za-z]{2}$/

/**
 * Teto de tamanho dos termos de busca.
 *
 * Nome de cidade/rua no Brasil não passa de ~60 caracteres. O limite existe
 * porque `q` e `city` são repassados ao Nominatim: sem ele, um termo de
 * milhares de caracteres viraria uma consulta externa inútil e caríssima a
 * cada requisição.
 */
const MAX_TERM = 80

/**
 * Corta o termo no teto em vez de rejeitar: digitar demais não é erro do
 * usuário. Só aceita string — o Express transforma `?q[a]=b` em objeto e
 * `?q=1&q=2` em array, que não são buscas válidas.
 */
function term(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, MAX_TERM) : ''
}

export async function searchCities(req: Request, res: Response) {
  const uf = String(req.query.uf ?? '')
  const q = term(req.query.q)

  if (!UF_RE.test(uf)) throw new AppError(400, 'Parâmetro "uf" inválido (use a sigla, ex.: RJ)')

  const items = await svc.searchCities(uf, q)
  // Cache de borda: a mesma busca repete muito entre usuários.
  res.set('Cache-Control', 'public, max-age=86400')
  res.json(items)
}

export async function searchStreets(req: Request, res: Response) {
  const uf = String(req.query.uf ?? '')
  const city = term(req.query.city)
  const q = term(req.query.q)

  if (!UF_RE.test(uf)) throw new AppError(400, 'Parâmetro "uf" inválido (use a sigla, ex.: RJ)')
  if (!city.trim()) throw new AppError(400, 'Parâmetro "city" é obrigatório')

  const items = await svc.searchStreets(uf, city, q)
  res.set('Cache-Control', 'public, max-age=86400')
  res.json(items)
}

export async function searchAddresses(req: Request, res: Response) {
  const q = term(req.query.q)
  const items = await svc.searchAddresses(q)
  res.set('Cache-Control', 'public, max-age=86400')
  res.json(items)
}

/**
 * Converte o parâmetro em coordenada.
 *
 * Exige string não-vazia antes do `Number`: `Number('')` é 0, então
 * `?lat=&lon=` passaria como a coordenada (0, 0) e gastaria uma chamada
 * ao Nominatim à toa.
 */
function coord(v: unknown): number {
  if (typeof v !== 'string' || !v.trim()) return NaN
  return Number(v)
}

export async function reverse(req: Request, res: Response) {
  const lat = coord(req.query.lat)
  const lon = coord(req.query.lon)

  // Coordenada tem de ser número finito e dentro do intervalo geográfico.
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new AppError(400, 'Parâmetro "lat" inválido')
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new AppError(400, 'Parâmetro "lon" inválido')
  }

  try {
    const addr = await svc.reverseGeocode(lat, lon)
    res.json(addr)
  } catch (err) {
    console.warn('[places] reverse geocode falhou:', (err as Error).message)
    throw new AppError(404, 'Nao foi possivel identificar o endereco desta localizacao')
  }
}
