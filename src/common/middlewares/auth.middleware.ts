import { Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'
import { prisma } from '../config/prisma'
import { AuthRequest } from '../types'

export async function isAuthenticated(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' })
    return
  }

  const token = authHeader.split(' ')[1]

  const blacklisted = await prisma.tokenBlacklist.findUnique({ where: { token } })
  if (blacklisted) {
    res.status(401).json({ error: 'Token inválido' })
    return
  }

  try {
    const payload = verifyAccessToken(token)
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}

export function isAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Acesso negado' })
    return
  }
  next()
}

export function isDriver(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'DRIVER' && req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Apenas motoristas podem acessar este recurso' })
    return
  }
  next()
}

export function isPassenger(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'PASSENGER' && req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Apenas passageiros podem acessar este recurso' })
    return
  }
  next()
}

export async function isVerified(req: AuthRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({ where: { id: req.user?.id } })
  if (!user?.isVerified) {
    res.status(403).json({ error: 'E-mail não verificado' })
    return
  }
  next()
}
