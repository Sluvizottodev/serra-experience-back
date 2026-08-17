import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'
import type { app as AppType } from './app'

const { prismaMock } = vi.hoisted(() => {
  const fn = () => {
    const mock: Record<string, unknown> = {}
    return new Proxy(mock, { get: () => vi.fn() })
  }
  return { prismaMock: fn() }
})

vi.mock('./common/config/prisma', () => ({ prisma: prismaMock }))

let app: typeof AppType

beforeAll(async () => {
  ;({ app } = await import('./app'))
})

describe('pipeline HTTP básica', () => {
  it('GET /health responde 200 com status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })

  it('aplica headers de segurança do helmet', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['content-security-policy']).toContain("default-src 'self'")
  })

  it('bloqueia origem CORS não permitida', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://origem-nao-permitida.com')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('permite origem CORS configurada', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173')
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('não lança ERR_ERL_UNEXPECTED_X_FORWARDED_FOR com header X-Forwarded-For presente', async () => {
    // Regressão: sem `app.set('trust proxy', 1)`, o express-rate-limit rejeita
    // requisições com X-Forwarded-For (sempre presente atrás do proxy da Vercel).
    const res = await request(app).get('/health').set('X-Forwarded-For', '203.0.113.10')
    expect(res.status).toBe(200)
  })

  it('rota inexistente não derruba a aplicação', async () => {
    const res = await request(app).get('/rota-que-nao-existe')
    expect(res.status).toBe(404)
  })
})
