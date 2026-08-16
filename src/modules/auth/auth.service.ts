import bcrypt from 'bcrypt'
import { prisma } from '../../common/config/prisma'
import { sendMail } from '../../common/config/mailer'
import { AppError } from '../../common/middlewares/error.middleware'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../common/utils/jwt'
import { generateOtp, generateSecureToken } from '../../common/utils/otp'
import { encrypt } from '../../common/utils/crypto'
import { notifyAdmins } from '../../common/utils/notify-admins'
import { tplNovoMotorista } from '../../common/utils/email.templates'
import type { RegisterInput, LoginInput, VerifyOtpInput, ForgotPasswordInput, ResetPasswordInput } from './auth.schema'

const OTP_EXPIRY_MINUTES = 10

export class AuthService {
  async register(data: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing && existing.isVerified) throw new AppError(409, 'Este e-mail já está cadastrado no sistema')

    const hashed = await bcrypt.hash(data.password, 12)
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            password: hashed,
            phone: data.phone,
            cpf: data.cpf ? encrypt(data.cpf) : undefined,
            role: data.role,
          },
        })
      : await prisma.user.create({
          data: {
            name: data.name,
            email: data.email,
            password: hashed,
            phone: data.phone,
            cpf: data.cpf ? encrypt(data.cpf) : undefined,
            role: data.role,
          },
        })

    await this.sendOtp(user.id, user.email)

    if (data.role === 'DRIVER') {
      const { subject, html } = tplNovoMotorista({ driverName: user.name, driverEmail: user.email, registeredAt: user.createdAt })
      notifyAdmins(subject, html).catch(() => {})
    }

    return { message: 'Conta criada. Verifique seu e-mail para confirmar.' }
  }

  async sendOtp(userId: string, email: string) {
    await prisma.otp.deleteMany({ where: { userId } })
    const code = generateOtp()
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
    await prisma.otp.create({ data: { code, userId, expiresAt } })

    await sendMail(
      email,
      'Código de verificação - Viagem com Motorista',
      `<h2>Seu código de verificação é: <strong>${code}</strong></h2><p>Expira em ${OTP_EXPIRY_MINUTES} minutos.</p>`
    )
  }

  async resendOtp(email: string) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw new AppError(404, 'Usuário não encontrado')
    if (user.isVerified) throw new AppError(400, 'E-mail já verificado')

    const recent = await prisma.otp.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    if (recent) {
      const secondsSince = (Date.now() - recent.createdAt.getTime()) / 1000
      if (secondsSince < 60) {
        const wait = Math.ceil(60 - secondsSince)
        throw new AppError(429, `Aguarde ${wait} segundos antes de solicitar um novo código`)
      }
    }

    await this.sendOtp(user.id, user.email)
    return { message: 'Novo código enviado para seu e-mail' }
  }

  async verifyOtp(data: VerifyOtpInput) {
    const user = await prisma.user.findUnique({ where: { email: data.email } })
    if (!user) throw new AppError(404, 'Usuário não encontrado')

    const otp = await prisma.otp.findFirst({
      where: { userId: user.id, code: data.code },
      orderBy: { createdAt: 'desc' },
    })

    if (!otp) throw new AppError(400, 'Código de verificação inválido')
    if (otp.expiresAt < new Date()) throw new AppError(400, 'Código de verificação expirado. Solicite um novo.')

    await prisma.user.update({ where: { id: user.id }, data: { isVerified: true } })
    await prisma.otp.deleteMany({ where: { userId: user.id } })

    return { message: 'E-mail verificado com sucesso' }
  }

  async login(data: LoginInput, res: import('express').Response) {
    const user = await prisma.user.findUnique({ where: { email: data.email } })
    if (!user) throw new AppError(401, 'Credenciais inválidas. Verifique seu e-mail e senha.')

    const valid = await bcrypt.compare(data.password, user.password)
    if (!valid) throw new AppError(401, 'Credenciais inválidas. Verifique seu e-mail e senha.')

    const payload = { id: user.id, role: user.role, email: user.email }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    })

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        avatarUrl: user.avatarUrl,
      },
    }
  }

  async refreshToken(token: string, res: import('express').Response) {
    if (!token) throw new AppError(401, 'Refresh token não fornecido')

    const stored = await prisma.refreshToken.findUnique({ where: { token } })
    if (!stored || stored.expiresAt < new Date()) throw new AppError(401, 'Sessão expirada. Faça login novamente.')

    const payload = verifyRefreshToken(token)
    const user = await prisma.user.findUnique({ where: { id: payload.id } })
    if (!user) throw new AppError(404, 'Usuário não encontrado')

    await prisma.refreshToken.delete({ where: { token } })

    const newPayload = { id: user.id, role: user.role, email: user.email }
    const accessToken = signAccessToken(newPayload)
    const newRefreshToken = signRefreshToken(newPayload)

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    })

    return { accessToken }
  }

  async logout(token: string, refreshToken: string, res: import('express').Response) {
    const decoded = (() => {
      try {
        const jwt = require('jsonwebtoken')
        return jwt.decode(token) as { exp?: number } | null
      } catch {
        return null
      }
    })()

    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.tokenBlacklist.create({ data: { token, expiresAt } })

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    })
    return { message: 'Logout realizado com sucesso' }
  }

  async forgotPassword(data: ForgotPasswordInput) {
    const user = await prisma.user.findUnique({ where: { email: data.email } })
    if (!user?.isVerified) return { message: 'Se o e-mail existir, você receberá as instruções.' }

    const existing = await prisma.otp.findMany({ where: { userId: user.id } })
    const resetTokens = existing.filter(o => o.code.length === 64)

    const lastReset = resetTokens.at(-1)
    if (lastReset) {
      const secondsSince = (Date.now() - lastReset.createdAt.getTime()) / 1000
      if (secondsSince < 60) {
        const wait = Math.ceil(60 - secondsSince)
        throw new AppError(429, `Aguarde ${wait} segundos antes de solicitar um novo link`)
      }
    }

    // Remove apenas os tokens de reset anteriores — OTPs de verificação intocados
    if (resetTokens.length > 0) {
      await prisma.otp.deleteMany({ where: { id: { in: resetTokens.map(o => o.id) } } })
    }

    const token = generateSecureToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await prisma.otp.create({ data: { code: token, userId: user.id, expiresAt } })

    const resetUrl = `${process.env.CORS_ORIGIN}/reset-password?token=${token}`
    await sendMail(
      user.email,
      'Redefinição de senha - Viagem com Motorista',
      `<p>Clique no link para redefinir sua senha:</p><a href="${resetUrl}">${resetUrl}</a><p>Expira em 1 hora.</p>`
    )

    return { message: 'Se o e-mail existir, você receberá as instruções.' }
  }

  async resetPassword(data: ResetPasswordInput) {
    const otp = await prisma.otp.findFirst({
      where: { code: data.token, expiresAt: { gt: new Date() } },
    })

    if (!otp) throw new AppError(400, 'Link de redefinição inválido ou expirado. Solicite um novo.')

    const hashed = await bcrypt.hash(data.password, 12)

    await prisma.$transaction([
      prisma.user.update({ where: { id: otp.userId }, data: { password: hashed } }),
      prisma.otp.deleteMany({ where: { userId: otp.userId } }),
      prisma.refreshToken.deleteMany({ where: { userId: otp.userId } }),
    ])

    return { message: 'Senha redefinida com sucesso' }
  }
}
