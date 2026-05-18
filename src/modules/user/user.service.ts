import { prisma } from '../../common/config/prisma'
import { cloudinary } from '../../common/config/cloudinary'
import { AppError } from '../../common/middlewares/error.middleware'
import type { UpdateUserInput } from './user.schema'

export class UserService {
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpf: true,
        role: true,
        isVerified: true,
        idStatus: true,
        avatarUrl: true,
        createdAt: true,
        driverProfile: {
          select: {
            id: true,
            isApproved: true,
            isAvailable: true,
            rating: true,
            totalTrips: true,
          },
        },
      },
    })
    if (!user) throw new AppError(404, 'Usuário não encontrado')
    return user
  }

  async updateMe(userId: string, data: UpdateUserInput) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpf: true,
        role: true,
        isVerified: true,
        avatarUrl: true,
      },
    })
  }

  async uploadAvatar(userId: string, fileBuffer: Buffer, mimetype: string) {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'viagem-motorista/avatars', resource_type: 'image' },
        (err, res) => {
          if (err || !res) return reject(err)
          resolve(res as { secure_url: string })
        }
      )
      stream.end(fileBuffer)
    })

    await prisma.user.update({ where: { id: userId }, data: { avatarUrl: result.secure_url } })
    return { avatarUrl: result.secure_url }
  }

  async uploadIdDocument(userId: string, fileBuffer: Buffer) {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'viagem-motorista/documents', resource_type: 'auto' },
        (err, res) => {
          if (err || !res) return reject(err)
          resolve(res as { secure_url: string })
        }
      )
      stream.end(fileBuffer)
    })

    await prisma.user.update({ where: { id: userId }, data: { idStatus: 'PENDING' } })
    return { message: 'Documento enviado. Aguardando aprovação.', url: result.secure_url }
  }
}
