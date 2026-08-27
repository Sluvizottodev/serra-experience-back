import { prisma } from '../../common/config/prisma'
import { AppError } from '../../common/middlewares/error.middleware'
import { TrackingEventType } from '@prisma/client'

function toSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function uniqueCode(base: string): Promise<string> {
  let code = base
  let attempt = 0
  while (true) {
    const found = await prisma.influencerEventLink.findUnique({ where: { code }, select: { id: true } })
    if (!found) return code
    attempt++
    code = `${base}-${attempt}`
  }
}

export class InfluencerService {
  async listInfluencers(activeOnly = false) {
    return prisma.influencer.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { createdAt: 'desc' },
    })
  }

  async createInfluencer(data: { name: string; handle?: string | null; notes?: string | null; active?: boolean }) {
    return prisma.influencer.create({ data })
  }

  async updateInfluencer(id: string, data: { name?: string; handle?: string | null; notes?: string | null; active?: boolean }) {
    const exists = await prisma.influencer.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw new AppError(404, 'Influenciador não encontrado')
    return prisma.influencer.update({ where: { id }, data })
  }

  async deleteInfluencer(id: string) {
    const exists = await prisma.influencer.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw new AppError(404, 'Influenciador não encontrado')
    return prisma.influencer.delete({ where: { id } })
  }

  async createLink(influencerId: string, eventId: string, customCode?: string) {
    const influencer = await prisma.influencer.findUnique({ where: { id: influencerId } })
    if (!influencer) throw new AppError(404, 'Influenciador não encontrado')

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event) throw new AppError(404, 'Evento não encontrado')

    // Múltiplos links são permitidos para o mesmo par influenciador+evento
    let code: string
    if (customCode) {
      const taken = await prisma.influencerEventLink.findUnique({ where: { code: customCode }, select: { id: true } })
      if (taken) throw new AppError(409, 'Este código já está em uso por outro link')
      code = customCode
    } else {
      code = await uniqueCode(`${toSlug(influencer.name)}-${event.slug}`)
    }

    return prisma.influencerEventLink.create({
      data: { influencerId, eventId, code },
    })
  }

  async listLinksForInfluencer(influencerId: string) {
    const links = await prisma.influencerEventLink.findMany({
      where: { influencerId },
      include: { event: { select: { id: true, title: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return this.attachMetrics(links)
  }

  async listLinksForEvent(eventId: string) {
    const links = await prisma.influencerEventLink.findMany({
      where: { eventId },
      include: { influencer: { select: { id: true, name: true, handle: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return this.attachMetrics(links)
  }

  private async attachMetrics<T extends { id: string }>(links: T[]) {
    if (links.length === 0) return []
    const linkIds = links.map(l => l.id)
    const counts = await prisma.trackingEvent.groupBy({
      by: ['linkId', 'type'],
      where: { linkId: { in: linkIds } },
      _count: true,
    })
    return links.map(link => {
      const views = counts.find(c => c.linkId === link.id && c.type === TrackingEventType.VIEW)?._count ?? 0
      const conversions = counts.find(c => c.linkId === link.id && c.type === TrackingEventType.CONVERSION)?._count ?? 0
      return {
        ...link,
        views,
        conversions,
        conversionRate: views > 0 ? Number(((conversions / views) * 100).toFixed(1)) : 0,
      }
    })
  }

  async getLinkByCode(code: string) {
    return prisma.influencerEventLink.findUnique({ where: { code } })
  }

  async trackView(code: string, visitorId?: string) {
    const link = await this.getLinkByCode(code)
    if (!link || !link.active) return
    await prisma.trackingEvent.create({
      data: {
        type: TrackingEventType.VIEW,
        linkId: link.id,
        eventId: link.eventId,
        influencerId: link.influencerId,
        visitorId,
      },
    })
  }

  async trackConversion(code: string, visitorId?: string) {
    const link = await this.getLinkByCode(code)
    if (!link || !link.active) return
    await prisma.trackingEvent.create({
      data: {
        type: TrackingEventType.CONVERSION,
        linkId: link.id,
        eventId: link.eventId,
        influencerId: link.influencerId,
        visitorId,
      },
    })
  }

  async getMetrics(filters: { eventId?: string; influencerId?: string }) {
    const where = {
      ...(filters.eventId ? { eventId: filters.eventId } : {}),
      ...(filters.influencerId ? { influencerId: filters.influencerId } : {}),
    }

    const links = await prisma.influencerEventLink.findMany({
      where: {
        ...(filters.eventId ? { eventId: filters.eventId } : {}),
        ...(filters.influencerId ? { influencerId: filters.influencerId } : {}),
      },
      include: {
        influencer: { select: { id: true, name: true, handle: true } },
        event: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (links.length === 0) return []

    const counts = await prisma.trackingEvent.groupBy({
      by: ['linkId', 'type'],
      where: { ...where, linkId: { in: links.map(l => l.id) } },
      _count: true,
    })

    return links.map(link => {
      const views = counts.find(c => c.linkId === link.id && c.type === TrackingEventType.VIEW)?._count ?? 0
      const conversions = counts.find(c => c.linkId === link.id && c.type === TrackingEventType.CONVERSION)?._count ?? 0
      return {
        ...link,
        views,
        conversions,
        conversionRate: views > 0 ? Number(((conversions / views) * 100).toFixed(1)) : 0,
      }
    })
  }
}
