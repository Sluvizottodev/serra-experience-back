import { prisma } from '../../common/config/prisma'
import { cloudinary } from '../../common/config/cloudinary'

function toSlug(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base
  let attempt = 0
  while (true) {
    const found = await prisma.event.findFirst({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    })
    if (!found) return slug
    attempt++
    slug = `${base}-${attempt}`
  }
}

export class EventService {
  async listEvents(activeOnly = false) {
    return prisma.event.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })
  }

  async findBySlug(slug: string) {
    const event = await prisma.event.findFirst({ where: { slug, active: true } })
    if (!event) throw Object.assign(new Error('Evento não encontrado'), { statusCode: 404 })
    return event
  }

  async listSitemap() {
    return prisma.event.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
      orderBy: { order: 'asc' },
    })
  }

  async createEvent(data: {
    title: string
    description?: string
    date?: string
    endDate?: string
    location?: string
    link?: string
    featured?: boolean
    active?: boolean
    order?: number
  }) {
    const duplicate = await prisma.event.findFirst({
      where: {
        title: { equals: data.title, mode: 'insensitive' },
        date: data.date ?? null,
        location: data.location ?? null,
      },
      select: { id: true },
    })
    if (duplicate) throw Object.assign(new Error('Já existe um evento com este título, data e local'), { statusCode: 409 })

    const slug = await uniqueSlug(toSlug(data.title))
    return prisma.event.create({ data: { ...data, slug } })
  }

  async updateEvent(
    id: string,
    data: {
      title?: string
      description?: string
      date?: string
      endDate?: string
      location?: string
      link?: string
      featured?: boolean
      active?: boolean
      order?: number
    },
  ) {
    const exists = await prisma.event.findUnique({ where: { id }, select: { id: true, title: true, slug: true } })
    if (!exists) throw Object.assign(new Error('Evento não encontrado'), { statusCode: 404 })

    let slug = exists.slug
    if (data.title && data.title !== exists.title) {
      slug = await uniqueSlug(toSlug(data.title), id)
    }

    return prisma.event.update({ where: { id }, data: { ...data, slug } })
  }

  async deleteEvent(id: string) {
    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) throw Object.assign(new Error('Evento não encontrado'), { statusCode: 404 })
    if (event.imagePublicId) {
      await cloudinary.uploader.destroy(event.imagePublicId).catch(() => null)
    }
    return prisma.event.delete({ where: { id } })
  }

  async uploadImage(id: string, fileBuffer: Buffer, mimetype: string) {
    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) throw Object.assign(new Error('Evento não encontrado'), { statusCode: 404 })

    if (event.imagePublicId) {
      await cloudinary.uploader.destroy(event.imagePublicId).catch(() => null)
    }

    const ext = mimetype === 'image/png' ? 'png' : mimetype === 'image/webp' ? 'webp' : 'jpg'
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'viagem-motorista/events', resource_type: 'image', format: ext },
        (err, res) => {
          if (err || !res) return reject(err)
          resolve(res as { secure_url: string; public_id: string })
        },
      )
      stream.end(fileBuffer)
    })

    return prisma.event.update({
      where: { id },
      data: { imageUrl: result.secure_url, imagePublicId: result.public_id },
    })
  }
}
