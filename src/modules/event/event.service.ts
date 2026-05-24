import { prisma } from '../../common/config/prisma'
import { cloudinary } from '../../common/config/cloudinary'

export class EventService {
  async listEvents(activeOnly = false) {
    return prisma.event.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })
  }

  async createEvent(data: {
    title: string
    description?: string
    date?: string
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
    return prisma.event.create({ data })
  }

  async updateEvent(
    id: string,
    data: {
      title?: string
      description?: string
      date?: string
      location?: string
      link?: string
      featured?: boolean
      active?: boolean
      order?: number
    },
  ) {
    const exists = await prisma.event.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw Object.assign(new Error('Evento não encontrado'), { statusCode: 404 })
    return prisma.event.update({ where: { id }, data })
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
