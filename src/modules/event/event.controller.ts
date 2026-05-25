import { Request, Response } from 'express'
import { EventService } from './event.service'

const service = new EventService()

export class EventController {
  async listPublic(_req: Request, res: Response) {
    const events = await service.listEvents(true)
    res.json(events)
  }

  async getBySlug(req: Request, res: Response) {
    const event = await service.findBySlug(String(req.params.slug))
    res.json(event)
  }

  async sitemap(_req: Request, res: Response) {
    const events = await service.listSitemap()
    res.json(events)
  }

  async listAdmin(_req: Request, res: Response) {
    const events = await service.listEvents(false)
    res.json(events)
  }

  async create(req: Request, res: Response) {
    const { title, description, date, endDate, location, link, featured, active, order } = req.body
    if (!title?.trim()) {
      res.status(400).json({ error: 'Título é obrigatório' })
      return
    }
    const event = await service.createEvent({
      title: title.trim(),
      description: description?.trim(),
      date: date?.trim(),
      endDate: endDate?.trim(),
      location: location?.trim(),
      link: link?.trim(),
      featured: featured === true || featured === 'true',
      active: active !== false && active !== 'false',
      order: Number(order) || 0,
    })
    res.status(201).json(event)
  }

  async update(req: Request, res: Response) {
    const { title, description, date, endDate, location, link, featured, active, order } = req.body
    const data: Record<string, unknown> = {}
    if (title !== undefined) data.title = title.trim()
    if (description !== undefined) data.description = description?.trim() || null
    if (date !== undefined) data.date = date?.trim() || null
    if (endDate !== undefined) data.endDate = endDate?.trim() || null
    if (location !== undefined) data.location = location?.trim() || null
    if (link !== undefined) data.link = link?.trim() || null
    if (featured !== undefined) data.featured = featured === true || featured === 'true'
    if (active !== undefined) data.active = active === true || active === 'true'
    if (order !== undefined) data.order = Number(order) || 0
    const event = await service.updateEvent(String(req.params.id), data)
    res.json(event)
  }

  async remove(req: Request, res: Response) {
    await service.deleteEvent(String(req.params.id))
    res.status(204).send()
  }

  async uploadImage(req: Request, res: Response) {
    if (!req.file) {
      res.status(400).json({ error: 'Arquivo não enviado' })
      return
    }
    const MAX_BYTES = 5 * 1024 * 1024
    if (req.file.size > MAX_BYTES) {
      res.status(400).json({ error: 'Imagem deve ter no máximo 5 MB' })
      return
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(req.file.mimetype)) {
      res.status(400).json({ error: 'Formato inválido. Use JPG, PNG ou WEBP' })
      return
    }
    const event = await service.uploadImage(
      String(req.params.id),
      req.file.buffer,
      req.file.mimetype,
    )
    res.json(event)
  }
}
