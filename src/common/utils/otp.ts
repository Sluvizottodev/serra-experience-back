import crypto from 'crypto'

export function generateOtp(): string {
  const buf = crypto.randomInt(100000, 1000000)
  return buf.toString()
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex')
}
