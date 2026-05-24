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
