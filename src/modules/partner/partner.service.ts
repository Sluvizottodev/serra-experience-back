import { prisma } from '../../common/config/prisma'
import { cloudinary } from '../../common/config/cloudinary'

export class PartnerService {
  async listPartners(activeOnly = false) {
    return prisma.partner.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async createPartner(data: {
    name: string
    description?: string | null
    link?: string | null
    active?: boolean
    order?: number
  }) {
    return prisma.partner.create({ data })
  }

  async updatePartner(id: string, data: {
    name?: string
    description?: string | null
    link?: string | null
    active?: boolean
    order?: number
  }) {
    const exists = await prisma.partner.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw Object.assign(new Error('Parceiro não encontrado'), { statusCode: 404 })
    return prisma.partner.update({ where: { id }, data })
  }

  async deletePartner(id: string) {
    const partner = await prisma.partner.findUnique({ where: { id } })
    if (!partner) throw Object.assign(new Error('Parceiro não encontrado'), { statusCode: 404 })
    if (partner.logoPublicId) {
      await cloudinary.uploader.destroy(partner.logoPublicId).catch(() => null)
    }
    return prisma.partner.delete({ where: { id } })
  }

  async uploadLogo(id: string, fileBuffer: Buffer, mimetype: string) {
    const partner = await prisma.partner.findUnique({ where: { id } })
    if (!partner) throw Object.assign(new Error('Parceiro não encontrado'), { statusCode: 404 })

    if (partner.logoPublicId) {
      await cloudinary.uploader.destroy(partner.logoPublicId).catch(() => null)
    }

    const ext = mimetype === 'image/png' ? 'png' : mimetype === 'image/webp' ? 'webp' : 'jpg'
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'viagem-motorista/partners', resource_type: 'image', format: ext },
        (err, res) => {
          if (err || !res) return reject(err)
          resolve(res as { secure_url: string; public_id: string })
        },
      )
      stream.end(fileBuffer)
    })

    return prisma.partner.update({
      where: { id },
      data: { logoUrl: result.secure_url, logoPublicId: result.public_id },
    })
  }
}
