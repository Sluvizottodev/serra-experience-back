import type { Request, Response } from 'express'
import { TestimonialService } from './testimonial.service'
import { createTestimonialSchema, updateTestimonialSchema } from './testimonial.schema'

const svc = new TestimonialService()

export async function listPublic(_req: Request, res: Response) {
  const items = await svc.listPublic()
  res.json(items)
}

export async function listAll(_req: Request, res: Response) {
  const items = await svc.listAll()
  res.json(items)
}

export async function create(req: Request, res: Response) {
  const parsed = createTestimonialSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const item = await svc.create(parsed.data)
  res.status(201).json(item)
}

export async function update(req: Request, res: Response) {
  const parsed = updateTestimonialSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  try {
    const item = await svc.update(String(req.params.id), parsed.data)
    res.json(item)
  } catch {
    res.status(404).json({ error: 'Depoimento não encontrado' })
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await svc.delete(String(req.params.id))
    res.status(204).end()
  } catch {
    res.status(404).json({ error: 'Depoimento não encontrado' })
  }
}

export async function uploadImage(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: 'Arquivo não enviado' })
  }
  const MAX_BYTES = 5 * 1024 * 1024
  if (req.file.size > MAX_BYTES) {
    return res.status(400).json({ error: 'Imagem deve ter no máximo 5 MB' })
  }
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Formato inválido. Use JPG, PNG ou WEBP' })
  }
  try {
    const item = await svc.uploadImage(String(req.params.id), req.file.buffer, req.file.mimetype)
    res.json(item)
  } catch {
    res.status(404).json({ error: 'Depoimento não encontrado' })
  }
}
