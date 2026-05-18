import crypto from 'crypto'

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex')
}
