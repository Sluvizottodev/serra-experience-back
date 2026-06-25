import { prisma } from '../../common/config/prisma'
import { cloudinary } from '../../common/config/cloudinary'
import { AppError } from '../../common/middlewares/error.middleware'
import { encrypt } from '../../common/utils/crypto'
import { notifyAdmins } from '../../common/utils/notify-admins'
import { tplDocumentoEnviado } from '../../common/utils/email.templates'
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
            vehicleStatus: true,
            rating: true,
            totalTrips: true,
            // Campos editáveis em "Meu Perfil" — precisam voltar preenchidos
            bio: true,
            vehicleMake: true,
            vehicleModel: true,
            vehicleYear: true,
            vehiclePlate: true,
            vehicleColor: true,
            vehicleCapacity: true,
            vehiclePhotoUrl: true,
            licenseNumber: true,
            licenseExpiry: true,
          },
        },
      },
    })
    if (!user) throw new AppError(404, 'Usuário não encontrado')
    // nunca expõe o CPF criptografado — apenas informa se está preenchido
    const { cpf, ...rest } = user
    return { ...rest, hasCpf: !!cpf }
  }

  async updateMe(userId: string, data: UpdateUserInput) {
    const updateData = {
      ...data,
      cpf: data.cpf ? encrypt(data.cpf) : undefined,
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        avatarUrl: true,
        cpf: true,
      },
    })
    const { cpf, ...rest } = user
    return { ...rest, hasCpf: !!cpf }
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })
    if (!user) throw new AppError(404, 'Usuário não encontrado')

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'viagem-motorista/documents', resource_type: 'auto' },
        (err, res) => {
          if (err || !res) return reject(new Error(err?.message ?? 'Upload failed'))
          resolve(res as { secure_url: string })
        }
      )
      stream.end(fileBuffer)
    })

    await prisma.user.update({ where: { id: userId }, data: { idStatus: 'PENDING' } })

    const { subject, html } = tplDocumentoEnviado({ userName: user.name, userEmail: user.email, userId })
    notifyAdmins(subject, html).catch(() => {})

    return { message: 'Documento enviado. Aguardando aprovação.', url: result.secure_url }
  }
}
