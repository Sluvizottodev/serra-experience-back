import { prisma } from '../../common/config/prisma'
import { cloudinary } from '../../common/config/cloudinary'
import type { Prisma } from '@prisma/client'

export class TestimonialService {
  listPublic() {
    return prisma.testimonial.findMany({
      where: { active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })
  }

  listAll() {
    return prisma.testimonial.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })
  }

  create(data: Prisma.TestimonialCreateInput) {
    return prisma.testimonial.create({ data })
  }

  update(id: string, data: Prisma.TestimonialUpdateInput) {
    return prisma.testimonial.update({ where: { id }, data })
  }

  async delete(id: string) {
    const testimonial = await prisma.testimonial.findUnique({ where: { id } })
    if (!testimonial) throw Object.assign(new Error('Depoimento não encontrado'), { statusCode: 404 })
    if (testimonial.imagePublicId) {
      await cloudinary.uploader.destroy(testimonial.imagePublicId).catch(() => null)
    }
    return prisma.testimonial.delete({ where: { id } })
  }

  async uploadImage(id: string, fileBuffer: Buffer, mimetype: string) {
    const testimonial = await prisma.testimonial.findUnique({ where: { id } })
    if (!testimonial) throw Object.assign(new Error('Depoimento não encontrado'), { statusCode: 404 })

    if (testimonial.imagePublicId) {
      await cloudinary.uploader.destroy(testimonial.imagePublicId).catch(() => null)
    }

    let ext = 'jpg'
    if (mimetype === 'image/png') ext = 'png'
    else if (mimetype === 'image/webp') ext = 'webp'

    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'viagem-motorista/testimonials', resource_type: 'image', format: ext },
        (err, res) => {
          if (err || !res) return reject(err instanceof Error ? err : new Error('Falha no upload da imagem'))
          resolve({ secure_url: res.secure_url, public_id: res.public_id })
        },
      )
      stream.end(fileBuffer)
    })

    return prisma.testimonial.update({
      where: { id },
      data: { type: 'IMAGE', imageUrl: result.secure_url, imagePublicId: result.public_id },
    })
  }
}
