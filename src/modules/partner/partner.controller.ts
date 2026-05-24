import { Request, Response } from 'express'
import { PartnerService } from './partner.service'

const service = new PartnerService()

export class PartnerController {
  async listPublic(_req: Request, res: Response) {
    const partners = await service.listPartners(true)
    res.json(partners)
  }

  async listAdmin(_req: Request, res: Response) {
    const partners = await service.listPartners(false)
    res.json(partners)
  }

  async create(req: Request, res: Response) {
    const { name, description, link, active, order } = req.body
    const partner = await service.createPartner({
      name: name.trim(),
      description: description?.trim() || null,
      link: link?.trim() || null,
      active: active !== false && active !== 'false',
      order: Number(order) || 0,
    })
    res.status(201).json(partner)
  }

  async update(req: Request, res: Response) {
    const { name, description, link, active, order } = req.body
    const data: Record<string, unknown> = {}
    if (name !== undefined)        data.name        = name.trim()
    if (description !== undefined) data.description = description?.trim() || null
    if (link !== undefined)        data.link        = link?.trim() || null
    if (active !== undefined)      data.active      = active === true || active === 'true'
    if (order !== undefined)       data.order       = Number(order) || 0
    const partner = await service.updatePartner(String(req.params.id), data)
    res.json(partner)
  }

  async remove(req: Request, res: Response) {
    await service.deletePartner(String(req.params.id))
    res.status(204).send()
  }

  async uploadLogo(req: Request, res: Response) {
    if (!req.file) {
      res.status(400).json({ error: 'Arquivo não enviado' })
      return
    }
    const MAX_BYTES = 2 * 1024 * 1024
    if (req.file.size > MAX_BYTES) {
      res.status(400).json({ error: 'Logo deve ter no máximo 2 MB' })
      return
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(req.file.mimetype)) {
      res.status(400).json({ error: 'Formato inválido. Use JPG, PNG, WEBP ou SVG' })
      return
    }
    const partner = await service.uploadLogo(
      String(req.params.id),
      req.file.buffer,
      req.file.mimetype,
    )
    res.json(partner)
  }
}
